import { sendTransactionalEmail } from '../email-helper.js';
import { logActivityEvent } from '../activity-helper.js';
import { stampReferralConversion } from '../creator-impact-helper.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!env.STRIPE_WEBHOOK_SECRET) {
      console.error("Stripe webhook secret not configured");
      return jsonResponse({ error: "Webhook secret not configured" }, 500);
    }

    if (!signature) {
      console.error("Missing stripe-signature header");
      return jsonResponse({ error: "Missing signature" }, 400);
    }

    const signatureParts = signature.split(",");
    let timestamp;
    let v1Signature;

    for (const part of signatureParts) {
      if (part.startsWith("t=")) {
        timestamp = part.slice(2);
      } else if (part.startsWith("v1=")) {
        v1Signature = part.slice(3);
      }
    }

    if (!timestamp || !v1Signature) {
      console.error("Invalid signature format - missing timestamp or v1");
      return jsonResponse({ error: "Invalid signature format" }, 400);
    }

    const webhookTimestamp = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const maxAge = 5 * 60;

    if (Number.isNaN(webhookTimestamp) || currentTime - webhookTimestamp > maxAge) {
      console.error("Webhook timestamp too old or invalid");
      return jsonResponse({ error: "Timestamp too old" }, 400);
    }

    const signedPayload = `${timestamp}.${body}`;
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(env.STRIPE_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(signedPayload)
    );

    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (expectedSignature !== v1Signature) {
      console.error("Invalid webhook signature");
      return jsonResponse({ error: "Invalid signature" }, 400);
    }

    const event = JSON.parse(body);

    const knownEventTypes = [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.deleted",
      "customer.subscription.updated",
      "invoice.payment_failed",
      "charge.refunded",
    ];

    if (!knownEventTypes.includes(event.type)) {
      console.log(`Unknown Stripe event type: ${event.type} - ignoring`);
      return jsonResponse({ received: true, unknown: true }, 200);
    }

    try {
      const existingEvent = await env.DB.prepare(
        "SELECT id FROM stripe_webhook_events WHERE id = ?"
      )
        .bind(event.id)
        .first();

      if (existingEvent) {
        console.log(`Ignoring duplicate Stripe webhook event: ${event.id} (${event.type})`);
        return jsonResponse({ received: true, duplicate: true }, 200);
      }

      console.log(`Processing new Stripe webhook event: ${event.id} (${event.type})`);
    } catch (dbError) {
      console.error("Idempotency database error:", dbError);
      return jsonResponse({ error: "Idempotency check failed" }, 500);
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const { userId } = session.metadata || {};
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        // Try to find user by metadata first, then fallback to Stripe IDs
        let user = null;
        if (userId) {
          user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
        }
        
        if (!user && (subscriptionId || customerId)) {
          user = await findUserByStripeIds(env, subscriptionId, customerId);
        }

        if (!user) {
          console.error("User not found for checkout session:", session.id);
          return jsonResponse({ error: "User not found" }, 400);
        }

        // Get subscription details to determine plan and status from price_id
        let plan = 'free';
        let subscriptionStatus = null;
        if (subscriptionId) {
          try {
            const subscriptionResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
              headers: {
                'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
              },
            });

            if (subscriptionResponse.ok) {
              const subscription = await subscriptionResponse.json();
              const priceId = subscription.items.data[0]?.price?.id;
              plan = getPlanFromPriceId(priceId, env, event.type, customerId, subscriptionId);
              subscriptionStatus = subscription.status;
            }
          } catch (error) {
            console.error('Failed to fetch subscription details:', error);
          }
        }

        // Handle founder checkout (one-time payment, no subscription)
        const paymentIntentId = session.payment_intent;
        const isFounderCheckout = plan === 'founder' || (session.metadata?.plan === 'founder');

        if (isFounderCheckout) {
          // Insert founder_access row (separate entitlement layer, does not overwrite plan/subscription_status)
          const grantedAt = new Date().toISOString();
          try {
            await env.DB.prepare(
              `INSERT OR IGNORE INTO founder_access (user_id, is_comped, source, granted_at, stripe_checkout_session_id, stripe_payment_intent_id)
               VALUES (?, 0, 'stripe_payment', ?, ?, ?)`
            ).bind(user.id, grantedAt, session.id, paymentIntentId).run();

            console.log(
              `Granted founder access to user ${user.id} from checkout session ${session.id}, payment intent ${paymentIntentId}`
            );

            // Log Founder purchase activity event (non-blocking)
            try {
              await logActivityEvent(env, {
                event_type: 'founder_purchased',
                target_user_id: user.id,
                event_title: 'Founder purchased',
                event_description: `User ${user.id} purchased Founder access via Stripe`,
                metadata_json: JSON.stringify({
                  checkout_session_id: session.id,
                  payment_intent_id: paymentIntentId
                }),
                severity: 'info',
                visibility_scope: 'billing'
              });
            } catch (activityError) {
              // Activity logging is non-blocking - log error but don't fail webhook processing
              console.error('Failed to log founder_purchased activity event:', activityError);
            }

            // Stamp Creator Impact referral conversion (non-blocking)
            try {
              await stampReferralConversion(env, String(user.id), 'founder', {
                conversionDate: grantedAt,
                metadata: {
                  event_type:         'checkout.session.completed',
                  checkout_session_id: session.id,
                  payment_intent_id:  paymentIntentId
                }
              });
            } catch (impactError) {
              console.error('[CREATOR IMPACT] Failed to stamp Founder conversion:', impactError);
            }

            // Send Founder welcome email
            try {
              // Fetch user email and first_name for personalization
              const userData = await env.DB.prepare(
                'SELECT email, first_name, founder_welcome_email_sent_at FROM users WHERE id = ?'
              ).bind(user.id).first();

              if (userData && userData.email && !userData.founder_welcome_email_sent_at) {
                const firstName = userData.first_name || 'there';

                await sendTransactionalEmail(env, {
                  to: userData.email,
                  subject: 'Welcome, Founder 🎉',
                  html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
                      <h2>Welcome, ${firstName} 🎉</h2>
                      <p>Founder Access Activated</p>

                      <p>Thank you for supporting TubeLinkr early.</p>

                      <p>Founder members help shape the future of the platform, and your support directly helps us continue building creator tools.</p>

                      <p>Your Founder access is now active.</p>

                      <p>You now have access to:</p>

                      <ul>
                        <li>✓ Creator Hub</li>
                        <li>✓ Branded creator links</li>
                        <li>✓ Video attribution insights</li>
                        <li>✓ Advanced analytics</li>
                        <li>✓ Founder status</li>
                      </ul>

                      <p><strong>Next steps:</strong></p>

                      <ol>
                        <li>Finish your TubeLinkr setup if needed</li>
                        <li>Connect your YouTube channel</li>
                        <li>Customize your Creator Hub</li>
                        <li>Set up your branded creator link</li>
                      </ol>

                      <p>After you complete the core setup, TubeLinkr will guide you through your Founder creator tools automatically.</p>

                      <p>
                        <a href="https://tubelinkr.com/dashboard"
                           style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">
                          Open Your Dashboard
                        </a>
                      </p>

                      <p>— TubeLinkr</p>
                    </div>
                  `
                });

                // Update founder_welcome_email_sent_at after successful send
                await env.DB.prepare(
                  'UPDATE users SET founder_welcome_email_sent_at = ? WHERE id = ?'
                ).bind(new Date().toISOString(), user.id).run();

                console.log(`Founder welcome email sent to user ${user.id}`);
              }
            } catch (emailError) {
              // Log error but don't break Stripe webhook processing
              console.error('Failed to send Founder welcome email:', emailError);
            }
          } catch (error) {
            console.error('Failed to insert founder_access row:', error);
            // Continue without failing - idempotency via INSERT OR IGNORE
          }
        } else {
          // Only set billing state based on actual subscription status for non-founder plans
          if (subscriptionStatus === 'active') {
            await env.DB.prepare(
              "UPDATE users SET plan = ?, subscription_status = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?"
            )
              .bind(plan, "active", customerId, subscriptionId, user.id)
              .run();

            console.log(
              `Updated user ${user.id} to plan ${plan} with active subscription, customer: ${customerId}, subscription: ${subscriptionId}`
            );

            // Log Pro upgrade activity event (non-blocking)
            try {
              await logActivityEvent(env, {
                event_type: 'pro_upgraded',
                target_user_id: user.id,
                event_title: 'User upgraded to Pro',
                event_description: `User ${user.id} upgraded to ${plan} via Stripe`,
                metadata_json: JSON.stringify({
                  plan,
                  subscription_id: subscriptionId,
                  customer_id: customerId
                }),
                severity: 'info',
                visibility_scope: 'billing'
              });
            } catch (activityError) {
              // Activity logging is non-blocking - log error but don't fail webhook processing
              console.error('Failed to log pro_upgraded activity event:', activityError);
            }

            // Stamp Creator Impact referral conversion (non-blocking)
            try {
              await stampReferralConversion(env, String(user.id), plan, {
                conversionDate: new Date().toISOString(),
                metadata: {
                  event_type:      'checkout.session.completed',
                  subscription_id: subscriptionId,
                  customer_id:     customerId
                }
              });
            } catch (impactError) {
              console.error('[CREATOR IMPACT] Failed to stamp Pro conversion:', impactError);
            }

            // Analytics: Track subscription activation
            console.log('📊 ANALYTICS: subscription_active', {
              event: 'subscription_active',
              properties: {
                userId: user.id,
                plan,
                customerId,
                subscriptionId,
                timestamp: new Date().toISOString(),
              },
            });

            // Send Pro welcome email for new Pro subscribers
            if (plan === 'pro' && subscriptionStatus === 'active') {
              try {
                // Fetch user email and first_name for personalization
                const userData = await env.DB.prepare(
                  'SELECT email, first_name, pro_welcome_email_sent_at FROM users WHERE id = ?'
                ).bind(user.id).first();

                if (userData && userData.email && !userData.pro_welcome_email_sent_at) {
                  const firstName = userData.first_name || 'there';

                  await sendTransactionalEmail(env, {
                    to: userData.email,
                    subject: 'Welcome to TubeLinkr Pro 🎉',
                    html: `
                      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
                        <h2>Welcome to TubeLinkr Pro, ${firstName}</h2>

                        <p>Your Pro features are now active. You have access to:</p>

                        <ul>
                          <li>✓ Unlimited Smart Links</li>
                          <li>✓ Creator Hub</li>
                          <li>✓ Branded creator links</li>
                          <li>✓ Video attribution insights</li>
                          <li>✓ Advanced analytics</li>
                        </ul>

                        <p><strong>Next steps:</strong></p>

                        <ol>
                          <li>Finish the basic TubeLinkr setup if you haven't already</li>
                          <li>Connect your YouTube channel</li>
                          <li>Customize your Creator Hub</li>
                          <li>Set up your branded creator link</li>
                        </ol>

                        <p>After you complete the core setup, TubeLinkr will guide you through your Pro creator tools automatically.</p>

                        <p>
                          <a href="https://tubelinkr.com/dashboard"
                             style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">
                            Open Your Dashboard
                          </a>
                        </p>

                        <p>— TubeLinkr</p>
                      </div>
                    `
                  });

                  // Update pro_welcome_email_sent_at after successful send
                  await env.DB.prepare(
                    'UPDATE users SET pro_welcome_email_sent_at = ? WHERE id = ?'
                  ).bind(new Date().toISOString(), user.id).run();

                  console.log(`Pro welcome email sent to user ${user.id}`);
                }
              } catch (emailError) {
                // Log error but don't break Stripe webhook processing
                console.error('Failed to send Pro welcome email:', emailError);
              }
            }
          } else {
            // Store Stripe IDs but don't mark as active until subscription is actually active
            await env.DB.prepare(
              "UPDATE users SET plan = ?, subscription_status = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?"
            )
              .bind(plan, subscriptionStatus || "incomplete", customerId, subscriptionId, user.id)
              .run();

            console.log(
              `Stored Stripe IDs for user ${user.id} with subscription status: ${subscriptionStatus || 'incomplete'}, plan: ${plan}`
            );
          }
        }
      }

      if (event.type === "customer.subscription.created") {
        const subscription = event.data.object;
        const subscriptionId = subscription.id;
        const customerId = subscription.customer;
        const status = subscription.status;

        const user = await findUserByStripeIds(env, subscriptionId, customerId);

        if (user) {
          // Get plan from price_id
          const priceId = subscription.items.data[0]?.price?.id;
          const plan = getPlanFromPriceId(priceId, env, event.type, customerId, subscriptionId);

          // Set billing state based on subscription status
          if (status === "active") {
            await env.DB.prepare(
              "UPDATE users SET plan = ?, subscription_status = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?"
            )
              .bind(plan, "active", customerId, subscriptionId, user.id)
              .run();

            console.log(`Subscription ${subscriptionId} created, user ${user.id} set to plan ${plan} with active status`);
          } else {
            // Non-active status, set to free but keep Stripe IDs
            await env.DB.prepare(
              "UPDATE users SET plan = ?, subscription_status = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?"
            )
              .bind("free", status, customerId, subscriptionId, user.id)
              .run();

            console.log(`Subscription ${subscriptionId} created with status ${status}, user ${user.id} set to free`);
          }
        }
      }

      if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object;
        const subscriptionId = subscription.id;

        const user = await env.DB.prepare(
          "SELECT id FROM users WHERE stripe_subscription_id = ?"
        )
          .bind(subscriptionId)
          .first();

        if (user) {
          await env.DB.prepare(
            "UPDATE users SET plan = ?, subscription_status = ?, stripe_subscription_id = ? WHERE id = ?"
          )
            .bind("free", "canceled", null, user.id)
            .run();

          console.log(`Subscription ${subscriptionId} deleted, downgraded user ${user.id} to free`);
        }
      }

      if (event.type === "customer.subscription.updated") {
        const subscription = event.data.object;
        const subscriptionId = subscription.id;
        const status = subscription.status;
        const customerId = subscription.customer;
        const eventCreated = event.created;
        const currentPeriodEnd = subscription.current_period_end;

        const user = await findUserByStripeIds(env, subscriptionId, customerId);

        if (user) {
          // Get plan from price_id
          const priceId = subscription.items.data[0]?.price?.id;
          const plan = getPlanFromPriceId(priceId, env, event.type, customerId, subscriptionId);

          if (status === "active") {
            // CRITICAL: Event-order protection to prevent stale events from reactivating canceled subscriptions
            // Only reject active events for the SAME subscription that was canceled
            // Allow NEW subscriptions (different subscription_id) to reactivate canceled users
            if (user.subscription_status === "canceled") {
              if (user.stripe_subscription_id === subscriptionId) {
                console.log(`[STALE EVENT PROTECTION] Ignoring subscription.updated (active) for user ${user.id} - same subscription already canceled. Event created: ${eventCreated}, Subscription period end: ${currentPeriodEnd}`);
                return jsonResponse({ received: true, ignored: true, reason: 'already_canceled' }, 200);
              }
              // Different subscription_id = new subscription, allow reactivation
              console.log(`[NEW SUBSCRIPTION] User ${user.id} resubscribing with new subscription ${subscriptionId}, allowing reactivation`);
            }

            await env.DB.prepare(
              "UPDATE users SET plan = ?, subscription_status = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?"
            )
              .bind(plan, "active", customerId, subscriptionId, user.id)
              .run();

            console.log(`Subscription updated to active, user ${user.id} set to plan ${plan}`);
          } else if (
            ["canceled", "unpaid", "incomplete_expired"].includes(status)
          ) {
            await env.DB.prepare(
              "UPDATE users SET plan = ?, subscription_status = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?"
            )
              .bind("free", status, customerId, subscriptionId, user.id)
              .run();

            console.log(
              `Subscription status ${status}, downgrading user ${user.id} to free`
            );
          } else if (status === "past_due") {
            // For past_due, keep the plan but update status
            await env.DB.prepare(
              "UPDATE users SET subscription_status = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?"
            )
              .bind("past_due", customerId, subscriptionId, user.id)
              .run();

            console.log(`Subscription status past_due, user ${user.id} keeping plan ${plan}`);
          }
        }
      }

      if (event.type === "invoice.payment_failed") {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        const customerId = invoice.customer;

        const user = await findUserByStripeIds(env, subscriptionId, customerId);

        if (user) {
          await env.DB.prepare(
            "UPDATE users SET subscription_status = ?, stripe_customer_id = ? WHERE id = ?"
          )
            .bind("past_due", customerId, user.id)
            .run();

          console.log(
            `Payment failed for subscription ${subscriptionId}, user ${user.id} marked as past_due`
          );
        }
      }

      if (event.type === "charge.refunded") {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent;

        if (paymentIntentId) {
          // Find and remove paid founder access by payment_intent_id
          // Only remove paid founders (is_comped = 0), not comped/admin grants
          const founderAccess = await env.DB.prepare(
            'SELECT user_id, is_comped FROM founder_access WHERE stripe_payment_intent_id = ?'
          ).bind(paymentIntentId).first();

          if (founderAccess && founderAccess.is_comped === 0) {
            await env.DB.prepare(
              'DELETE FROM founder_access WHERE stripe_payment_intent_id = ?'
            ).bind(paymentIntentId).run();

            console.log(
              `Revoked founder access for user ${founderAccess.user_id} due to refund of payment intent ${paymentIntentId}`
            );

            // Log refund activity event (non-blocking)
            try {
              await logActivityEvent(env, {
                event_type: 'founder_refunded',
                target_user_id: founderAccess.user_id,
                event_title: 'Founder access refunded',
                event_description: `User ${founderAccess.user_id} Founder access revoked due to refund`,
                metadata_json: JSON.stringify({
                  payment_intent_id: paymentIntentId,
                  charge_id: charge.id
                }),
                severity: 'info',
                visibility_scope: 'billing'
              });
            } catch (activityError) {
              console.error('Failed to log founder_refunded activity event:', activityError);
            }
          } else if (founderAccess && founderAccess.is_comped === 1) {
            console.log(
              `Ignoring refund for comped founder access (user ${founderAccess.user_id}, payment intent ${paymentIntentId})`
            );
          }
        }
      }
    } catch (businessError) {
      console.error("Webhook business logic error:", businessError);
      return jsonResponse(
        { error: businessError.message || "Webhook handler failed" },
        500
      );
    }

    try {
      await env.DB.prepare(
        "INSERT INTO stripe_webhook_events (id, type) VALUES (?, ?)"
      )
        .bind(event.id, event.type)
        .run();

      console.log(
        `Successfully processed and recorded Stripe webhook event: ${event.id} (${event.type})`
      );
    } catch (insertError) {
      console.error("Failed to insert processed webhook event:", insertError);

      if (
        insertError.message &&
        insertError.message.includes("UNIQUE constraint failed")
      ) {
        console.log(
          `Webhook event already recorded (race condition): ${event.id} (${event.type})`
        );
        return jsonResponse({ received: true, duplicate: true }, 200);
      }

      return jsonResponse({ error: "Failed to record webhook event" }, 500);
    }

    return jsonResponse({ received: true }, 200);
  } catch (error) {
    console.error("Stripe webhook fatal error:", error);
    return jsonResponse({ error: error.message || "Webhook failed" }, 500);
  }
}

// Helper function to map Stripe price_id to plan
// CRITICAL: Unknown price IDs must fail loudly to prevent silent downgrades in production
function getPlanFromPriceId(priceId, env, eventType = 'unknown', customerId = null, subscriptionId = null) {
  if (!priceId || !env) {
    const error = `Missing priceId or env in getPlanFromPriceId. Event: ${eventType}, Customer: ${customerId}, Subscription: ${subscriptionId}`;
    console.error(`[CRITICAL] ${error}`);
    throw new Error(error);
  }
  
  // Map price IDs to plans using environment variables
  if (priceId === env.PRO_PRICE_ID_MONTHLY || priceId === env.PRO_PRICE_ID_YEARLY) {
    return 'pro';
  } else if (priceId === env.PRO_PLUS_PRICE_ID_MONTHLY || priceId === env.PRO_PLUS_PRICE_ID_YEARLY) {
    return 'pro_plus';
  }
  
  // CRITICAL: Unknown price ID - fail loudly instead of silently defaulting to 'free'
  // This prevents production configuration errors from silently downgrading paying users
  const error = `Unknown Stripe price ID: ${priceId}. Event: ${eventType}, Customer: ${customerId}, Subscription: ${subscriptionId}. This indicates a configuration mismatch between Stripe and environment variables.`;
  console.error(`[CRITICAL] ${error}`);
  throw new Error(error);
}

// Helper function to find user by subscription or customer ID
// CRITICAL: Returns all lifecycle fields needed for safe webhook event ordering decisions
// This prevents stale/delayed Stripe events from incorrectly reactivating canceled subscriptions
async function findUserByStripeIds(env, subscriptionId, customerId) {
  // Try by subscription ID first
  if (subscriptionId) {
    const user = await env.DB.prepare(
      'SELECT id, plan, subscription_status, stripe_customer_id, stripe_subscription_id FROM users WHERE stripe_subscription_id = ?'
    ).bind(subscriptionId).first();
    if (user) return user;
  }
  
  // Fallback to customer ID
  if (customerId) {
    const user = await env.DB.prepare(
      'SELECT id, plan, subscription_status, stripe_customer_id, stripe_subscription_id FROM users WHERE stripe_customer_id = ?'
    ).bind(customerId).first();
    if (user) return user;
  }
  
  return null;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}