import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as Icons from 'lucide-react';
import { AuthUser } from '../types';

export type AuthMode = 'login' | 'register' | 'forgot_password' | 'phone_otp' | 'google_oauth' | '2fa_verify';

interface AuthConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser;
  onLoginSuccess: (user: AuthUser, authMethod: 'password' | 'google' | 'phone_otp' | 'sso') => void;
  handleAddAuditLog: (
    operator: string,
    action: string,
    module: string,
    status: 'SUCCESS' | 'FAILED' | 'PENDING_APPROVAL',
    payload: string
  ) => void;
}

export default function AuthConsoleModal({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
  handleAddAuditLog,
}: AuthConsoleModalProps) {
  const [mode, setMode] = useState<AuthMode>('login');

  // Form State - Login
  const [email, setEmail] = useState('eshanbaruabarua@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Form State - Registration
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('+1 (555) 019-2834');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regPod, setRegPod] = useState('SRE & Infrastructure Pod');
  const [regRole, setRegRole] = useState('Lead Security Auditor & Engineer');
  const [regEnable2FA, setRegEnable2FA] = useState(true);
  const [regAgreedTerms, setRegAgreedTerms] = useState(true);

  // Form State - Phone OTP
  const [phoneCountry, setPhoneCountry] = useState('+1');
  const [phoneNum, setPhoneNum] = useState('(555) 234-5678');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState(['9', '8', '7', '6', '5', '4']);
  const [otpTimer, setOtpTimer] = useState(30);

  // Form State - Forgot Password
  const [forgotEmailOrPhone, setForgotEmailOrPhone] = useState('eshanbaruabarua@gmail.com');
  const [resetSent, setResetSent] = useState(false);
  const [resetCode, setResetCode] = useState('482910');
  const [newPassword, setNewPassword] = useState('');

  // Form State - 2FA Verification
  const [twoFactorCode, setTwoFactorCode] = useState(['8', '4', '9', '2', '0', '1']);
  const [twoFactorMethod, setTwoFactorMethod] = useState<'totp' | 'sms'>('totp');
  const [pendingUser, setPendingUser] = useState<AuthUser | null>(null);

  // Feedback State
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // OTP Resend Timer
  useEffect(() => {
    let interval: any = null;
    if (otpSent && otpTimer > 0) {
      interval = setInterval(() => setOtpTimer((t) => t - 1), 1000);
    } else if (otpTimer === 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [otpSent, otpTimer]);

  if (!isOpen) return null;

  // Handle standard Email/Password Login
  const handleEmailPasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      // Simulate account look-up
      const targetUser: AuthUser = {
        id: 'usr_cto_01',
        name: 'Eshan Barua (CTO)',
        email: email || 'eshanbaruabarua@gmail.com',
        role: 'Chief Technology Officer & Lead Security Auditor',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
        pod: 'SRE & Executive Operations',
        phone: '+1 (555) 019-2834',
        is2FAEnabled: true,
        authMethod: 'password',
      };

      if (targetUser.is2FAEnabled) {
        setPendingUser(targetUser);
        setMode('2fa_verify');
        handleAddAuditLog(
          targetUser.name,
          'PASSWORD_AUTH_PENDING_2FA',
          'Authentication Engine',
          'PENDING_APPROVAL',
          `Primary credentials validated for ${targetUser.email}. 2FA verification challenge triggered.`
        );
      } else {
        onLoginSuccess(targetUser, 'password');
        handleAddAuditLog(
          targetUser.name,
          'LOGIN_EMAIL_PASSWORD',
          'Authentication Engine',
          'SUCCESS',
          `User ${targetUser.email} authenticated via encrypted Password credentials.`
        );
      }
    }, 600);
  };

  // Handle Google OAuth Sign-In
  const handleGoogleOAuthSelect = (selectedEmail: string, selectedName: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    setTimeout(() => {
      setIsLoading(false);
      const googleUser: AuthUser = {
        id: 'usr_g_02',
        name: selectedName,
        email: selectedEmail,
        role: 'Chief Technology Officer & Executive Lead',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
        pod: 'SRE & Infrastructure Pod',
        phone: '+1 (555) 019-2834',
        is2FAEnabled: false,
        authMethod: 'google',
      };

      onLoginSuccess(googleUser, 'google');
      handleAddAuditLog(
        googleUser.name,
        'GOOGLE_OAUTH_LOGIN',
        'Identity & Access Management',
        'SUCCESS',
        `Authenticated via Google Workspace OAuth 2.0 Identity Provider (${googleUser.email}). Token verified.`
      );
    }, 700);
  };

  // Handle Send Phone SMS OTP
  const handleSendPhoneOTP = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setOtpSent(true);
      setOtpTimer(30);
      setSuccessMessage(`SMS OTP verification code sent to ${phoneCountry} ${phoneNum}`);
      handleAddAuditLog(
        'System Security Gate',
        'PHONE_OTP_DISPATCH',
        'Authentication Engine',
        'SUCCESS',
        `Dispatched 6-digit SMS OTP token to ${phoneCountry} ${phoneNum}`
      );
    }, 600);
  };

  // Handle Verify Phone OTP
  const handleVerifyPhoneOTP = (e: React.FormEvent) => {
    e.preventDefault();
    const codeStr = otpCode.join('');
    if (codeStr.length < 6) {
      setErrorMessage('Please enter the full 6-digit OTP code.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      const phoneUser: AuthUser = {
        id: 'usr_phone_03',
        name: 'Eshan Barua (Verified Phone Operator)',
        email: 'eshanbaruabarua@gmail.com',
        role: 'Verified Support Engineer',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
        pod: 'Security & Incident Response',
        phone: `${phoneCountry} ${phoneNum}`,
        is2FAEnabled: false,
        authMethod: 'phone_otp',
      };

      onLoginSuccess(phoneUser, 'phone_otp');
      handleAddAuditLog(
        phoneUser.name,
        'PHONE_OTP_VERIFIED',
        'Authentication Engine',
        'SUCCESS',
        `SMS OTP code (${codeStr}) verified successfully for phone number ${phoneCountry} ${phoneNum}. Session authorized.`
      );
    }, 600);
  };

  // Handle Registration
  const handleRegisterUser = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match. Please verify your entry.');
      return;
    }
    if (!regAgreedTerms) {
      setErrorMessage('You must agree to the Security Compliance & Operating Terms.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      const newUser: AuthUser = {
        id: `usr_${Date.now().toString().slice(-4)}`,
        name: regName || 'New Engineering Operator',
        email: regEmail || 'operator@supportpilot.ai',
        role: regRole,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
        pod: regPod,
        phone: regPhone,
        is2FAEnabled: regEnable2FA,
        authMethod: 'password',
      };

      if (regEnable2FA) {
        setPendingUser(newUser);
        setMode('2fa_verify');
        setSuccessMessage('Account registered successfully! Please complete mandatory 2FA enrollment.');
        handleAddAuditLog(
          newUser.name,
          'ACCOUNT_REGISTERED_2FA_REQUIRED',
          'Identity Management',
          'SUCCESS',
          `New operator account registered for ${newUser.email} (${newUser.pod}). Prompting initial 2FA token code.`
        );
      } else {
        onLoginSuccess(newUser, 'password');
        handleAddAuditLog(
          newUser.name,
          'USER_REGISTRATION_SUCCESS',
          'Identity Management',
          'SUCCESS',
          `Created new operator account for ${newUser.email} with assigned role "${newUser.role}".`
        );
      }
    }, 700);
  };

  // Handle Forgot Password Reset
  const handleForgotPasswordRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setResetSent(true);
      setSuccessMessage('Verification code dispatched to your registered email/phone.');
      handleAddAuditLog(
        'Security Compliance Gate',
        'PASSWORD_RESET_DISPATCH',
        'Identity Security',
        'SUCCESS',
        `Dispatched password recovery verification token for identifier: ${forgotEmailOrPhone}`
      );
    }, 600);
  };

  const handleCompletePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setSuccessMessage('Password reset successfully! You can now log in with your new credentials.');
      setMode('login');
      handleAddAuditLog(
        forgotEmailOrPhone,
        'PASSWORD_RESET_COMPLETED',
        'Identity Security',
        'SUCCESS',
        `Password updated for account ${forgotEmailOrPhone}. Previous security tokens invalidated.`
      );
    }, 600);
  };

  // Handle 2FA Code Verification
  const handleVerify2FACode = (e: React.FormEvent) => {
    e.preventDefault();
    const codeStr = twoFactorCode.join('');
    if (codeStr.length < 6) {
      setErrorMessage('Please enter the complete 6-digit security code.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      const finalUser = pendingUser || currentUser;
      onLoginSuccess(finalUser, finalUser.authMethod || 'password');
      handleAddAuditLog(
        finalUser.name,
        '2FA_VERIFICATION_SUCCESS',
        'Multi-Factor Auth Engine',
        'SUCCESS',
        `Two-Factor Authentication code (${codeStr}) validated successfully. Full administrative workspace session unlocked.`
      );
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: -15 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 md:p-8 shadow-2xl shadow-indigo-950/40 relative overflow-hidden text-slate-100 my-auto"
      >
        {/* Glow accent decoration */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header Branding */}
        <div className="relative text-center mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 mb-3 shadow-inner">
            <Icons.ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-base font-black tracking-wider uppercase text-white font-display">
            SupportPilot AI Workspace
          </h2>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-widest">
            Enterprise Identity & Authentication Console
          </p>
        </div>

        {/* Global Notifications */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xxs flex items-center space-x-2">
            <Icons.AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xxs flex items-center space-x-2">
            <Icons.CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* MODE 1: LOGIN (Email / Password / Social / Phone Options) */}
        {mode === 'login' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <form onSubmit={handleEmailPasswordLogin} className="space-y-3.5">
              <div className="space-y-1 text-left">
                <label className="text-[9.5px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Work Email Address</span>
                  <span className="text-indigo-400 text-[8.5px]">SSO & Identity Ready</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@company.com"
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/90 pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none transition-all"
                  />
                  <Icons.Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                </div>
              </div>

              <div className="space-y-1 text-left">
                <div className="flex items-center justify-between">
                  <label className="text-[9.5px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                    Operator Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setSuccessMessage(null);
                      setMode('forgot_password');
                    }}
                    className="text-[9px] font-mono text-indigo-400 hover:text-indigo-300 cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/90 pl-9 pr-9 py-2.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none transition-all"
                  />
                  <Icons.Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <Icons.EyeOff className="h-4 w-4" /> : <Icons.Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xxs text-slate-400 pt-1">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500/20"
                  />
                  <span>Keep session active on this console</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white hover:bg-indigo-500 transition-all cursor-pointer shadow-lg shadow-indigo-600/25 disabled:opacity-50"
              >
                {isLoading ? (
                  <Icons.RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Icons.LogIn className="h-4 w-4" />
                    <span>Sign In to Operational Workspace</span>
                  </>
                )}
              </button>
            </form>

            <div className="relative my-4 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <span className="relative bg-slate-950 px-3 text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                or sign in with
              </span>
            </div>

            {/* Quick Auth Alternatives */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  setMode('google_oauth');
                }}
                className="flex items-center justify-center space-x-2 rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-xs text-slate-200 hover:bg-slate-800 hover:border-slate-700 transition-all cursor-pointer"
              >
                <Icons.Chrome className="h-4 w-4 text-emerald-400" />
                <span className="font-semibold text-xxs">Google OAuth</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  setMode('phone_otp');
                }}
                className="flex items-center justify-center space-x-2 rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-xs text-slate-200 hover:bg-slate-800 hover:border-slate-700 transition-all cursor-pointer"
              >
                <Icons.Smartphone className="h-4 w-4 text-indigo-400" />
                <span className="font-semibold text-xxs">Phone SMS OTP</span>
              </button>
            </div>

            <div className="text-center pt-3 border-t border-slate-900 mt-4">
              <p className="text-[10px] text-slate-400">
                New engineering operator?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    setMode('register');
                  }}
                  className="font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                >
                  Create new account
                </button>
              </p>
            </div>
          </motion.div>
        )}

        {/* MODE 2: GOOGLE OAUTH FLOW */}
        {mode === 'google_oauth' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 text-center space-y-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Icons.Chrome className="h-5 w-5 animate-pulse" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Google Workspace Single Sign-On
              </h3>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Select a verified Google identity to grant administrative access to SupportPilot AI.
              </p>

              <div className="space-y-2 text-left pt-2">
                {/* Default CTO Account */}
                <button
                  type="button"
                  onClick={() => handleGoogleOAuthSelect('eshanbaruabarua@gmail.com', 'Eshan Barua (CTO)')}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/50 transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80"
                      alt="Eshan Barua"
                      className="h-8 w-8 rounded-full border border-indigo-500/30 object-cover"
                    />
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-indigo-300">
                        Eshan Barua (CTO)
                      </div>
                      <div className="text-[9px] font-mono text-slate-400">eshanbaruabarua@gmail.com</div>
                    </div>
                  </div>
                  <Icons.ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-indigo-400" />
                </button>

                {/* Secondary Demo Account */}
                <button
                  type="button"
                  onClick={() => handleGoogleOAuthSelect('dev-lead@supportpilot.ai', 'Alex Rivera (SRE Lead)')}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/50 transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
                      AR
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-indigo-300">
                        Alex Rivera (SRE Lead)
                      </div>
                      <div className="text-[9px] font-mono text-slate-400">dev-lead@supportpilot.ai</div>
                    </div>
                  </div>
                  <Icons.ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-indigo-400" />
                </button>
              </div>

              <div className="text-[9px] text-slate-500 font-mono pt-2 border-t border-slate-800/80">
                OAuth Scopes Requested: email, profile, openid
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMode('login')}
              className="w-full rounded-xl bg-slate-900 border border-slate-800 py-2.5 text-xs text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              Back to Login Options
            </button>
          </motion.div>
        )}

        {/* MODE 3: PHONE SMS OTP */}
        {mode === 'phone_otp' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {!otpSent ? (
              <form onSubmit={handleSendPhoneOTP} className="space-y-4">
                <div className="text-center">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">SMS Phone Authentication</h3>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Enter your mobile phone number to receive a 6-digit security token via SMS.
                  </p>
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-[9.5px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                    Mobile Number
                  </label>
                  <div className="flex space-x-2">
                    <select
                      value={phoneCountry}
                      onChange={(e) => setPhoneCountry(e.target.value)}
                      className="rounded-xl border border-slate-800 bg-slate-900 px-2 py-2.5 text-xs text-indigo-300 font-mono focus:outline-none"
                    >
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+44">🇬🇧 +44</option>
                      <option value="+91">🇮🇳 +91</option>
                      <option value="+880">🇧🇩 +880</option>
                      <option value="+49">🇩🇪 +49</option>
                    </select>
                    <input
                      type="tel"
                      value={phoneNum}
                      onChange={(e) => setPhoneNum(e.target.value)}
                      placeholder="(555) 019-2834"
                      required
                      className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white hover:bg-indigo-500 transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  {isLoading ? (
                    <Icons.RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Icons.Smartphone className="h-4 w-4" />
                      <span>Send 6-Digit SMS Security Code</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyPhoneOTP} className="space-y-4">
                <div className="text-center">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Enter SMS Verification Code</h3>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Sent code to <span className="text-indigo-300 font-mono">{phoneCountry} {phoneNum}</span>
                  </p>
                </div>

                {/* 6-digit OTP Inputs */}
                <div className="flex justify-center space-x-2 py-2">
                  {otpCode.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`otp-${idx}`}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newOtp = [...otpCode];
                        newOtp[idx] = val;
                        setOtpCode(newOtp);
                        if (val && idx < 5) {
                          const nextInput = document.getElementById(`otp-${idx + 1}`);
                          if (nextInput) nextInput.focus();
                        }
                      }}
                      className="w-10 h-12 rounded-xl border border-slate-800 bg-slate-900 text-center font-mono text-base font-bold text-indigo-300 focus:border-indigo-500 focus:outline-none"
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-xxs text-slate-400">
                  <button
                    type="button"
                    disabled={otpTimer > 0}
                    onClick={() => {
                      setOtpTimer(30);
                      setSuccessMessage('Resent SMS verification code.');
                    }}
                    className="font-mono text-indigo-400 hover:text-indigo-300 disabled:text-slate-600 cursor-pointer"
                  >
                    {otpTimer > 0 ? `Resend Code in ${otpTimer}s` : 'Resend SMS Code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="text-slate-400 hover:text-slate-200 underline"
                  >
                    Change Number
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white hover:bg-emerald-500 transition-all cursor-pointer shadow-lg shadow-emerald-600/20"
                >
                  {isLoading ? (
                    <Icons.RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Icons.CheckCircle2 className="h-4 w-4" />
                      <span>Verify Code & Unlock Console</span>
                    </>
                  )}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => {
                setOtpSent(false);
                setMode('login');
              }}
              className="w-full rounded-xl bg-slate-900 border border-slate-800 py-2.5 text-xs text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              Back to Standard Login
            </button>
          </motion.div>
        )}

        {/* MODE 4: REGISTRATION */}
        {mode === 'register' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3.5">
            <form onSubmit={handleRegisterUser} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5 text-left">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Eshan Barua"
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                    Work Email
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="eshan@company.com"
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-left">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                    Assigned Engineering Pod
                  </label>
                  <select
                    value={regPod}
                    onChange={(e) => setRegPod(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-2 py-2 text-xs text-indigo-300 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="SRE & Infrastructure Pod">SRE & Infrastructure Pod</option>
                    <option value="Core Backend & DB Pod">Core Backend & DB Pod</option>
                    <option value="Kubernetes Platform Pod">Kubernetes Platform Pod</option>
                    <option value="Security & Incident Response">Security & Incident Response</option>
                    <option value="API Gateway & Microservices">API Gateway & Microservices</option>
                    <option value="L1 Support & Dispatch">L1 Support & Dispatch</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                    Mobile Phone
                  </label>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+1 (555) 019-2834"
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-left">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                    Password
                  </label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Security Preferences */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-left">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center space-x-2">
                    <Icons.KeyRound className="h-4 w-4 text-indigo-400" />
                    <div>
                      <div className="text-xs font-bold text-white">Enable Mandatory 2FA Protection</div>
                      <div className="text-[9px] text-slate-400">Require 6-digit TOTP token during login</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={regEnable2FA}
                    onChange={(e) => setRegEnable2FA(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500/20"
                  />
                </label>
              </div>

              <label className="flex items-start space-x-2 text-[10px] text-slate-400 text-left pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={regAgreedTerms}
                  onChange={(e) => setRegAgreedTerms(e.target.checked)}
                  className="mt-0.5 rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500/20"
                />
                <span>
                  I agree to the <span className="text-indigo-400 font-semibold">Security Compliance Terms</span> and system audit logging rules.
                </span>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white hover:bg-indigo-500 transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
              >
                {isLoading ? (
                  <Icons.RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Icons.UserPlus className="h-4 w-4" />
                    <span>Create Operator Account</span>
                  </>
                )}
              </button>
            </form>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                Already registered? Back to Login
              </button>
            </div>
          </motion.div>
        )}

        {/* MODE 5: FORGOT PASSWORD */}
        {mode === 'forgot_password' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {!resetSent ? (
              <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
                <div className="text-center">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Account Password Recovery</h3>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Enter your registered email address or phone number to receive a security reset token.
                  </p>
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-[9.5px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                    Work Email or Phone Number
                  </label>
                  <input
                    type="text"
                    value={forgotEmailOrPhone}
                    onChange={(e) => setForgotEmailOrPhone(e.target.value)}
                    placeholder="operator@company.com or +1 (555) 019-2834"
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white hover:bg-indigo-500 transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  {isLoading ? (
                    <Icons.RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Icons.Mail className="h-4 w-4" />
                      <span>Send Recovery Token</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleCompletePasswordReset} className="space-y-3.5">
                <div className="text-center">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Reset Account Password</h3>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Enter the verification code sent to <span className="text-indigo-300 font-mono">{forgotEmailOrPhone}</span>
                  </p>
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-[9.5px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="482910"
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-center font-mono text-base font-bold text-indigo-300 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-[9.5px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                    New Operator Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white hover:bg-emerald-500 transition-all cursor-pointer shadow-lg shadow-emerald-600/20"
                >
                  {isLoading ? (
                    <Icons.RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Icons.CheckCircle2 className="h-4 w-4" />
                      <span>Update Password & Save</span>
                    </>
                  )}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => {
                setResetSent(false);
                setMode('login');
              }}
              className="w-full rounded-xl bg-slate-900 border border-slate-800 py-2.5 text-xs text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              Back to Login Options
            </button>
          </motion.div>
        )}

        {/* MODE 6: TWO-FACTOR AUTHENTICATION (2FA) VERIFICATION */}
        {mode === '2fa_verify' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mb-2">
                <Icons.QrCode className="h-6 w-6 animate-pulse" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Two-Factor Security Verification
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Enter the 6-digit verification code from your <span className="text-indigo-300 font-semibold">Authenticator App</span> or <span className="text-indigo-300 font-semibold">SMS Security Key</span>.
              </p>
            </div>

            {/* 2FA Method Switch */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xxs">
              <button
                type="button"
                onClick={() => setTwoFactorMethod('totp')}
                className={`py-1.5 rounded-lg font-bold transition-all ${
                  twoFactorMethod === 'totp'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Authenticator App
              </button>
              <button
                type="button"
                onClick={() => setTwoFactorMethod('sms')}
                className={`py-1.5 rounded-lg font-bold transition-all ${
                  twoFactorMethod === 'sms'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                SMS Backup Code
              </button>
            </div>

            <form onSubmit={handleVerify2FACode} className="space-y-4">
              <div className="flex justify-center space-x-2 py-2">
                {twoFactorCode.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`2fa-${idx}`}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => {
                      const val = e.target.value;
                      const newCode = [...twoFactorCode];
                      newCode[idx] = val;
                      setTwoFactorCode(newCode);
                      if (val && idx < 5) {
                        const nextInput = document.getElementById(`2fa-${idx + 1}`);
                        if (nextInput) nextInput.focus();
                      }
                    }}
                    className="w-10 h-12 rounded-xl border border-slate-800 bg-slate-900 text-center font-mono text-base font-bold text-indigo-300 focus:border-indigo-500 focus:outline-none"
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-xxs text-slate-400 font-mono">
                <span>Verification Window: 30s</span>
                <button
                  type="button"
                  onClick={() => {
                    setTwoFactorCode(['8', '4', '9', '2', '0', '1']);
                    setSuccessMessage('Generated fresh 2FA challenge code.');
                  }}
                  className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                >
                  Resend Security Code
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white hover:bg-indigo-500 transition-all cursor-pointer shadow-lg shadow-indigo-600/25"
              >
                {isLoading ? (
                  <Icons.RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Icons.ShieldCheck className="h-4 w-4" />
                    <span>Authorize Session & Unlock Workspace</span>
                  </>
                )}
              </button>
            </form>

            <button
              type="button"
              onClick={() => setMode('login')}
              className="w-full rounded-xl bg-slate-900 border border-slate-800 py-2.5 text-xs text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              Cancel & Return to Login
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
