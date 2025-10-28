import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, ArrowRight } from 'lucide-react';
import Button from '../../components/Button';

export default function Signup() {
  const { signUp } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
    }
    
    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }
    
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      errors.password = 'Password must contain uppercase, lowercase, and number';
    }
    
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    if (!acceptedTerms) {
      errors.terms = 'Please accept the terms and conditions';
    }
    
    setFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      // Show toast with the first error
      const firstError = Object.values(errors)[0];
      showToast(firstError, 'error');
    }
    
    return Object.keys(errors).length === 0;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      const result = await signUp(
        formData.email.toLowerCase().trim(),
        formData.password,
        formData.firstName.trim(),
        formData.lastName.trim()
      );
      
      if (result.success) {
        navigate('/');
        showToast('Account created successfully!', 'success');
      } else {
        showToast(result.error || 'Failed to create account', 'error');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const getPasswordStrength = () => {
    const password = formData.password;
    if (password.length === 0) return { strength: 0, label: '' };
    if (password.length < 6) return { strength: 1, label: 'Weak' };
    if (password.length < 8) return { strength: 2, label: 'Fair' };
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) return { strength: 2, label: 'Fair' };
    return { strength: 3, label: 'Strong' };
  };

  const passwordStrength = getPasswordStrength();

  return (
    <div className="flex min-h-full flex-col justify-center">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <img
          src="/assets/images/planmoni_logo_main.png"
          alt="Planmoni Office"
          className="mx-auto h-20 w-auto"
          onError={(e) => {
            // Fallback to text if image fails to load
            e.currentTarget.style.display = 'none';
            const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
            if (nextElement) {
              nextElement.style.display = 'block';
            }
          }}
        />
        <h1 className="text-xl font-bold text-primary text-center mt-2" style={{ display: 'none' }}>
          Planmoni Admin
        </h1>
        <h2 className="mt-6 text-center text-2xl font-bold leading-9 text-text">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-text-secondary">
          Join Planmoni and start managing your platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-lg sm:rounded-lg sm:px-10 border border-border">
          <div className="mb-6">
            <Link to="/login" className="inline-flex items-center text-text-secondary hover:text-text">
              <ArrowLeft className="h-5 w-5 mr-1" />
              Back to login
            </Link>
          </div>

          <form onSubmit={handleSignUp} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium leading-6 text-text">
                  First Name
                </label>
                <div className="relative mt-2">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <User className="h-5 w-5 text-text-secondary" aria-hidden="true" />
                  </div>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => updateFormData('firstName', e.target.value)}
                    className={`block w-full rounded-md border-0 py-3 pl-10 text-gray-900 shadow-sm ring-1 ring-inset ${
                      formErrors.firstName ? 'ring-error' : 'ring-border'
                    } bg-white focus:ring-2 focus:ring-inset focus:ring-primary`}
                    placeholder="First name"
                  />
                </div>
                {formErrors.firstName && (
                  <p className="mt-2 text-sm text-error">{formErrors.firstName}</p>
                )}
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium leading-6 text-text">
                  Last Name
                </label>
                <div className="relative mt-2">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <User className="h-5 w-5 text-text-secondary" aria-hidden="true" />
                  </div>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => updateFormData('lastName', e.target.value)}
                    className={`block w-full rounded-md border-0 py-3 pl-10 text-gray-900 shadow-sm ring-1 ring-inset ${
                      formErrors.lastName ? 'ring-error' : 'ring-border'
                    } bg-white focus:ring-2 focus:ring-inset focus:ring-primary`}
                    placeholder="Last name"
                  />
                </div>
                {formErrors.lastName && (
                  <p className="mt-2 text-sm text-error">{formErrors.lastName}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium leading-6 text-text">
                Email Address
              </label>
              <div className="relative mt-2">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-text-secondary" aria-hidden="true" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) => updateFormData('email', e.target.value)}
                  className={`block w-full rounded-md border-0 py-3 pl-10 text-gray-900 shadow-sm ring-1 ring-inset ${
                    formErrors.email ? 'ring-error' : 'ring-border'
                  } bg-white focus:ring-2 focus:ring-inset focus:ring-primary`}
                  placeholder="Enter your email"
                />
              </div>
              {formErrors.email && (
                <p className="mt-2 text-sm text-error">{formErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium leading-6 text-text">
                Password
              </label>
              <div className="relative mt-2">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-text-secondary" aria-hidden="true" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={(e) => updateFormData('password', e.target.value)}
                  className={`block w-full rounded-md border-0 py-3 pl-10 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ${
                    formErrors.password ? 'ring-error' : 'ring-border'
                  } bg-white focus:ring-2 focus:ring-inset focus:ring-primary`}
                  placeholder="Create a password"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-text-secondary hover:text-text focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
              
              {formData.password.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 h-1 rounded-full bg-border">
                      <div 
                        className={`h-full rounded-full ${
                          passwordStrength.strength === 1 ? 'bg-error' : 
                          passwordStrength.strength === 2 ? 'bg-warning' : 
                          'bg-success'
                        }`} 
                        style={{ width: `${(passwordStrength.strength / 3) * 100}%` }}
                      />
                    </div>
                    <span 
                      className={`text-xs font-medium ${
                        passwordStrength.strength === 1 ? 'text-error' : 
                        passwordStrength.strength === 2 ? 'text-warning' : 
                        'text-success'
                      }`}
                    >
                      {passwordStrength.label}
                    </span>
                  </div>
                </div>
              )}
              
              {formErrors.password && (
                <p className="mt-2 text-sm text-error">{formErrors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium leading-6 text-text">
                Confirm Password
              </label>
              <div className="relative mt-2">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-text-secondary" aria-hidden="true" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                  className={`block w-full rounded-md border-0 py-3 pl-10 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ${
                    formErrors.confirmPassword ? 'ring-error' : 'ring-border'
                  } bg-white focus:ring-2 focus:ring-inset focus:ring-primary`}
                  placeholder="Confirm your password"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-text-secondary hover:text-text focus:outline-none"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
              {formErrors.confirmPassword && (
                <p className="mt-2 text-sm text-error">{formErrors.confirmPassword}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-start">
                <div className="flex h-6 items-center">
                  <input
                    id="terms"
                    name="terms"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={() => {
                      setAcceptedTerms(!acceptedTerms);
                      if (formErrors.terms) {
                        setFormErrors(prev => ({ ...prev, terms: '' }));
                      }
                    }}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                </div>
                <div className="ml-3 text-sm leading-6">
                  <label htmlFor="terms" className="text-text-secondary">
                    I agree to the{' '}
                    <a href="#" className="text-primary hover:underline">
                      Terms of Service
                    </a>
                    {' '}and{' '}
                    <a href="#" className="text-primary hover:underline">
                      Privacy Policy
                    </a>
                  </label>
                </div>
              </div>
              {formErrors.terms && (
                <p className="text-sm text-error">{formErrors.terms}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full flex justify-center items-center gap-2"
              isLoading={isLoading}
              disabled={isLoading}
              icon={!isLoading && <ArrowRight className="h-5 w-5" />}
            >
              Create Account
            </Button>

            <div className="text-center">
              <p className="text-text-secondary">
                Already have an account?{' '}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
      
      <div className="mt-8 text-center text-xs text-text-tertiary">
        <p>© {new Date().getFullYear()} Planmoni. All rights reserved.</p>
      </div>
    </div>
  );
}