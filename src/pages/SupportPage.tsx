import { useState } from 'react';
import { PublicNav } from '../components/PublicNav';

export function SupportPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.category) {
      newErrors.category = 'Please select a category';
    }

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Message must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsSubmitting(false);
        setSubmitSuccess(true);
        setFormData({
          name: '',
          email: '',
          category: '',
          subject: '',
          message: '',
        });
      } else {
        setIsSubmitting(false);
        // Handle server-side validation errors
        if (data.errors) {
          setErrors(data.errors);
        } else {
          setErrors({ message: data.error || 'Sorry, your message could not be sent. Please try again.' });
        }
      }
    } catch (error) {
      setIsSubmitting(false);
      setErrors({ message: 'Sorry, your message could not be sent. Please try again.' });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gray-950">
      <PublicNav />

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Support</h1>
        <p className="text-gray-400 text-lg mb-8">Need help with InLinkr? We're here to help.</p>

        {/* FAQ Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-6">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              <h3 className="text-lg font-semibold text-white mb-2">How do I connect my YouTube account?</h3>
              <p className="text-gray-300">
                To connect your YouTube account, sign in to InLinkr and navigate to Settings. Click "Connect YouTube" and authorize InLinkr to access your channel information. This allows you to associate Smart Links with your videos and view analytics.
              </p>
            </div>

            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              <h3 className="text-lg font-semibold text-white mb-2">How do Smart Links work?</h3>
              <p className="text-gray-300">
                Smart Links are tracked links you can place in your YouTube descriptions, pinned comments, bios, and other locations. When someone clicks a Smart Link, InLinkr records the click and attributes it to the specific placement, allowing you to see which content drives the most engagement.
              </p>
            </div>

            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              <h3 className="text-lg font-semibold text-white mb-2">How do I upgrade my account?</h3>
              <p className="text-gray-300">
                To upgrade to Pro, navigate to Settings and click "Upgrade to Pro" in the Subscription section. You'll be directed to Stripe checkout where you can choose a plan. Pro users get access to advanced analytics, Creator Hub, and additional features.
              </p>
            </div>

            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              <h3 className="text-lg font-semibold text-white mb-2">How do I revoke InLinkr's access to my Google account?</h3>
              <p className="text-gray-300">
                You can revoke InLinkr's access to your Google account at any time by visiting{' '}
                <a href="https://myaccount.google.com/permissions" className="text-blue-400 hover:text-blue-300" target="_blank" rel="noopener noreferrer">
                  https://myaccount.google.com/permissions
                </a>
                {' '}and removing InLinkr from the list of connected apps. This will prevent InLinkr from accessing your Google data going forward.
              </p>
            </div>
          </div>
        </div>

        {/* Contact Form Section */}
        <div>
          <h2 className="text-2xl font-semibold text-white mb-6">Contact Us</h2>
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            {submitSuccess ? (
              <div className="text-center py-8">
                <div className="text-green-400 text-4xl mb-4">✓</div>
                <h3 className="text-xl font-semibold text-white mb-2">Thanks — your message has been sent.</h3>
                <p className="text-gray-300">
                  We'll review it and respond as soon as possible.
                </p>
                <button
                  onClick={() => setSubmitSuccess(false)}
                  className="mt-6 px-4 py-2 bg-primary hover:bg-primary text-white rounded-md transition-colors"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Honeypot field - hidden from users */}
                <input
                  type="text"
                  name="website"
                  className="hidden"
                  tabIndex={-1}
                  autoComplete="off"
                  onChange={handleChange}
                />

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 bg-gray-800 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary ${
                      errors.name ? 'border-red-500' : 'border-gray-700'
                    }`}
                    placeholder="Your name"
                  />
                  {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 bg-gray-800 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary ${
                      errors.email ? 'border-red-500' : 'border-gray-700'
                    }`}
                    placeholder="your@email.com"
                  />
                  {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-2">
                    Category
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 bg-gray-800 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary ${
                      errors.category ? 'border-red-500' : 'border-gray-700'
                    }`}
                  >
                    <option value="">Select a category</option>
                    <option value="Account Issues">Account Issues</option>
                    <option value="Billing">Billing</option>
                    <option value="YouTube Connection">YouTube Connection</option>
                    <option value="Smart Links">Smart Links</option>
                    <option value="Creator Hub">Creator Hub</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.category && <p className="text-red-400 text-sm mt-1">{errors.category}</p>}
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-300 mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 bg-gray-800 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary ${
                      errors.subject ? 'border-red-500' : 'border-gray-700'
                    }`}
                    placeholder="Brief description of your issue"
                  />
                  {errors.subject && <p className="text-red-400 text-sm mt-1">{errors.subject}</p>}
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows={6}
                    className={`w-full px-4 py-2 bg-gray-800 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary resize-none ${
                      errors.message ? 'border-red-500' : 'border-gray-700'
                    }`}
                    placeholder="Please describe your issue in detail (minimum 10 characters)"
                  />
                  {errors.message && <p className="text-red-400 text-sm mt-1">{errors.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-primary hover:bg-primary disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
