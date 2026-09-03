import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as Icons from 'lucide-react';
import { AuthUser } from '../types';

export type AuthMode = 
  | 'login' 
  | 'register' 
  | 'forgot_password' 
  | 'phone_otp' 
  | 'google_oauth' 
  | 'sso_login'
  | '2fa_verify' 
  | '2fa_setup'
  | 'success_state';

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
  const [email, setEmail] = useState('admin@supportpilot.ai');
  const [password, setPassword] = useState('admin123');
  // Form State - Password Visibility Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // Form State - Enterprise SSO / OAuth
  const [ssoProvider, setSsoProvider] = useState<'okta' | 'microsoft' | 'google' | 'ping'>('okta');
  const [ssoDomain, setSsoDomain] = useState('supportpilot.okta.com');

  // Success State Transition
  const [successUserData, setSuccessUserData] = useState<AuthUser | null>(null);
  const [successAuthMethod, setSuccessAuthMethod] = useState<'password' | 'google' | 'phone_otp' | 'sso'>('password');
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

  // Form State - Forgot Password Recovery Flow
  const [forgotEmailOrPhone, setForgotEmailOrPhone] = useState('admin@supportpilot.ai');
  const [resetSent, setResetSent] = useState(false);
  const [dispatchedResetToken, setDispatchedResetToken] = useState('RESET-TOK-8942-X9');
  const [dispatchedResetCode, setDispatchedResetCode] = useState('482910');
  const [inputResetToken, setInputResetToken] = useState('RESET-TOK-8942-X9');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showEmailInboxPreview, setShowEmailInboxPreview] = useState(true);

  // Form State - 2FA Verification (Login Challenge)
  const [twoFactorCode, setTwoFactorCode] = useState(['8', '4', '9', '2', '0', '1']);
  const [twoFactorMethod, setTwoFactorMethod] = useState<'totp' | 'sms'>('totp');
  const [pendingUser, setPendingUser] = useState<AuthUser | null>(null);

  // Form State - 2FA Setup Wizard (TOTP Enrollment)
  const [setup2FACode, setSetup2FACode] = useState(['', '', '', '', '', '']);
  const [setup2FASecret] = useState('JBSWY3DPEHPK3PXP-2026');
  const [isCopiedSecret, setIsCopiedSecret] = useState(false);

  // Feedback State & Error Feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);

  // Trigger error shake animation
  const triggerErrorState = (msg: string, fields: string[] = []) => {
    setErrorMessage(msg);
    setInvalidFields(fields);
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const triggerLoginSuccessState = (user: AuthUser, authMethod: 'password' | 'google' | 'phone_otp' | 'sso') => {
    setSuccessUserData(user);
    setSuccessAuthMethod(authMethod);
    setMode('success_state');
  };

  useEffect(() => {
    if (mode === 'success_state' && successUserData) {
      const timer = setTimeout(() => {
        onLoginSuccess(successUserData, successAuthMethod);
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [mode, successUserData, successAuthMethod, onLoginSuccess]);

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
    setInvalidFields([]);

    if (!email || !email.includes('@')) {
      triggerErrorState('Please enter a valid work email address.', ['email']);
      return;
    }
    if (!password) {
      triggerErrorState('Please enter your operator password.', ['password']);
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      const sessionToken = `sp_sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const targetUser: AuthUser = {
        id: 'usr_cto_01',
        name: 'Alex Vance (Admin)',
        email: email || 'admin@supportpilot.ai',
        role: 'Chief Technology Officer & Lead Security Auditor',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
        pod: 'SRE & Executive Operations',
        phone: '+1 (555) 019-2834',
        is2FAEnabled: true,
        authMethod: 'password',
        sessionToken,
      };

      if (targetUser.is2FAEnabled) {
        setPendingUser(targetUser);
        setTwoFactorCode(['8', '4', '9', '2', '0', '1']);
        setMode('2fa_verify');
        handleAddAuditLog(
          targetUser.name,
          'PASSWORD_AUTH_PENDING_2FA',
          'Authentication Engine',
          'PENDING_APPROVAL',
          `Primary credentials validated for ${targetUser.email}. Prompting mandatory 2FA TOTP code.`
        );
      } else {
        triggerLoginSuccessState(targetUser, 'password');
        handleAddAuditLog(
          targetUser.name,
          'LOGIN_EMAIL_PASSWORD',
          'Authentication Engine',
          'SUCCESS',
          `User ${targetUser.email} authenticated via Password. Session token stored.`
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
      const sessionToken = `sp_sess_oauth_${Date.now()}`;
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
        sessionToken,
      };

      triggerLoginSuccessState(googleUser, 'google');
      handleAddAuditLog(
        googleUser.name,
        'GOOGLE_OAUTH_LOGIN',
        'Identity & Access Management',
        'SUCCESS',
        `Authenticated via Google Workspace OAuth 2.0 (${googleUser.email}). Persistent session established.`
      );
    }, 600);
  };

  // Handle Enterprise SSO / SAML 2.0 Sign-In
  const handleSsoLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!ssoDomain || !ssoDomain.includes('.')) {
      triggerErrorState('Please enter a valid SSO identity domain (e.g., supportpilot.okta.com)', ['ssoDomain']);
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      const sessionToken = `sp_sess_sso_${ssoProvider}_${Date.now()}`;
      const ssoUser: AuthUser = {
        id: `usr_sso_${Date.now().toString().slice(-4)}`,
        name: 'Alex Vance (SSO Operator)',
        email: 'admin@supportpilot.ai',
        role: `Enterprise Operator (${ssoProvider.toUpperCase()})`,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
        pod: 'SRE & Platform Engineering',
        phone: '+1 (555) 019-2834',
        is2FAEnabled: false,
        authMethod: 'sso',
        sessionToken,
      };

      triggerLoginSuccessState(ssoUser, 'sso');
      handleAddAuditLog(
        ssoUser.name,
        'SSO_SAML2_AUTHENTICATION',
        'Enterprise Identity Portal',
        'SUCCESS',
        `Authenticated via Enterprise SSO / SAML 2.0 (${ssoProvider.toUpperCase()} - ${ssoDomain}). Domain token validated.`
      );
    }, 700);
  };

  // Handle Send Phone SMS OTP
  const handleSendPhoneOTP = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!phoneNum || phoneNum.length < 7) {
      triggerErrorState('Please enter a valid mobile phone number.', ['phoneNum']);
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setOtpSent(true);
      setOtpTimer(30);
      setOtpCode(['9', '8', '7', '6', '5', '4']); // Autofill demo code
      setSuccessMessage(`SMS OTP verification code (987654) dispatched to ${phoneCountry} ${phoneNum}`);
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
      triggerErrorState('Please enter the complete 6-digit SMS code.', ['otpCode']);
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      const sessionToken = `sp_sess_otp_${Date.now()}`;
      const phoneUser: AuthUser = {
        id: 'usr_phone_03',
        name: 'Alex Vance (Verified Phone Operator)',
        email: 'admin@supportpilot.ai',
        role: 'Verified Support Engineer',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
        pod: 'Security & Incident Response',
        phone: `${phoneCountry} ${phoneNum}`,
        is2FAEnabled: false,
        authMethod: 'phone_otp',
        sessionToken,
      };

      triggerLoginSuccessState(phoneUser, 'phone_otp');
      handleAddAuditLog(
        phoneUser.name,
        'PHONE_OTP_VERIFIED',
        'Authentication Engine',
        'SUCCESS',
        `SMS OTP code (${codeStr}) verified for ${phoneCountry} ${phoneNum}. Persistent session authorized.`
      );
    }, 600);
  };

  // Handle Registration
  const handleRegisterUser = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInvalidFields([]);

    if (!regName) {
      triggerErrorState('Full Name is required.', ['regName']);
      return;
    }
    if (!regEmail || !regEmail.includes('@')) {
      triggerErrorState('Valid Work Email address is required.', ['regEmail']);
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      triggerErrorState('Password must be at least 6 characters.', ['regPassword']);
      return;
    }
    if (regPassword !== regConfirmPassword) {
      triggerErrorState('Passwords do not match. Please re-check.', ['regPassword', 'regConfirmPassword']);
      return;
    }
    if (!regAgreedTerms) {
      triggerErrorState('You must agree to the Security Compliance & Operating Terms.', ['regAgreedTerms']);
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      const sessionToken = `sp_sess_reg_${Date.now()}`;
      const newUser: AuthUser = {
        id: `usr_${Date.now().toString().slice(-4)}`,
        name: regName,
        email: regEmail,
        role: regRole,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
        pod: regPod,
        phone: regPhone,
        is2FAEnabled: regEnable2FA,
        authMethod: 'password',
        sessionToken,
      };

      if (regEnable2FA) {
        setPendingUser(newUser);
        setMode('2fa_setup');
        setSuccessMessage('Account registered successfully! Complete 2FA setup to finalize enrollment.');
        handleAddAuditLog(
          newUser.name,
          'ACCOUNT_REGISTERED_2FA_SETUP',
          'Identity Management',
          'SUCCESS',
          `Registered new operator account for ${newUser.email} (${newUser.pod}). Redirected to 2FA setup wizard.`
        );
      } else {
        triggerLoginSuccessState(newUser, 'password');
        handleAddAuditLog(
          newUser.name,
          'USER_REGISTRATION_SUCCESS',
          'Identity Management',
          'SUCCESS',
          `Created operator account for ${newUser.email} with role "${newUser.role}". Session token stored.`
        );
      }
    }, 700);
  };

  // Handle Forgot Password Request (Dispatches Simulated Reset Email with Token)
  const handleForgotPasswordRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!forgotEmailOrPhone || !forgotEmailOrPhone.includes('@')) {
      triggerErrorState('Please enter a valid work email address to receive reset token.', ['forgotEmailOrPhone']);
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      const genToken = `RESET-TOK-${Math.floor(1000 + Math.random() * 9000)}-X9`;
      const genCode = `${Math.floor(100000 + Math.random() * 900000)}`;
      setDispatchedResetToken(genToken);
      setDispatchedResetCode(genCode);
      setInputResetToken(genToken); // Autofill token for quick demo testing
      setResetSent(true);
      setShowEmailInboxPreview(true);
      setSuccessMessage(`Simulated password reset email sent to ${forgotEmailOrPhone}! Check email token below.`);
      handleAddAuditLog(
        'Security Compliance Gate',
        'PASSWORD_RESET_DISPATCH',
        'Identity Security',
        'SUCCESS',
        `Dispatched password recovery email with validation token (${genToken}) to: ${forgotEmailOrPhone}`
      );
    }, 600);
  };

  // Handle Complete Password Reset Validation
  const handleCompletePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInvalidFields([]);

    if (!inputResetToken || inputResetToken.trim().toUpperCase() !== dispatchedResetToken.toUpperCase()) {
      triggerErrorState(`Invalid validation token. Expected token: ${dispatchedResetToken}`, ['inputResetToken']);
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      triggerErrorState('New password must be at least 6 characters long.', ['newPassword']);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      triggerErrorState('Passwords do not match. Please verify entries.', ['newPassword', 'confirmNewPassword']);
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setSuccessMessage('Password reset successfully! Log in with your new credentials.');
      setPassword(newPassword);
      setEmail(forgotEmailOrPhone);
      setResetSent(false);
      setMode('login');
      handleAddAuditLog(
        forgotEmailOrPhone,
        'PASSWORD_RESET_COMPLETED',
        'Identity Security',
        'SUCCESS',
        `Password updated for account ${forgotEmailOrPhone}. Token ${inputResetToken} validated and invalidated.`
      );
    }, 700);
  };

  // Handle 2FA Setup Enrollment Completion (Wizard)
  const handleComplete2FASetup = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const codeStr = setup2FACode.join('');
    if (codeStr.length < 6) {
      triggerErrorState('Please enter the full 6-digit code from your Authenticator app.', ['setup2FACode']);
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      const target = pendingUser || currentUser;
      const updatedUser: AuthUser = {
        ...target,
        is2FAEnabled: true,
        totpSecret: setup2FASecret,
      };

      triggerLoginSuccessState(updatedUser, (updatedUser.authMethod as any) || 'password');
      handleAddAuditLog(
        updatedUser.name,
        '2FA_ENROLLMENT_COMPLETED',
        'Multi-Factor Auth Engine',
        'SUCCESS',
        `TOTP 2FA configured and verified with key (${setup2FASecret}). Multi-Factor Security enforced.`
      );
    }, 700);
  };

  // Handle 2FA Challenge Code Verification (Login)
  const handleVerify2FACode = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const codeStr = twoFactorCode.join('');
    if (codeStr.length < 6) {
      triggerErrorState('Please enter the complete 6-digit security code.', ['twoFactorCode']);
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      const finalUser = pendingUser || currentUser;
      triggerLoginSuccessState(finalUser, (finalUser.authMethod as any) || 'password');
      handleAddAuditLog(
        finalUser.name,
        '2FA_VERIFICATION_SUCCESS',
        'Multi-Factor Auth Engine',
        'SUCCESS',
        `Two-Factor code (${codeStr}) validated successfully. Persistent session unlocked.`
      );
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl p-4 overflow-y-auto">
      <motion.div
        animate={isShaking ? { x: [-12, 12, -8, 8, -4, 4, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 md:p-8 shadow-2xl shadow-indigo-950/40 relative overflow-hidden text-slate-100 my-auto"
      >
        {/* Ambient Glow Accent */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top Right Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer z-10"
          title="Close Identity Console"
        >
          <Icons.X className="h-4 w-4" />
        </button>

        {/* Modal Header Branding */}
        <div className="relative text-center mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 mb-2.5 shadow-inner">
            <Icons.ShieldCheck className="h-6 w-6 text-indigo-400" />
          </div>
          <h2 className="text-base font-black tracking-wider uppercase text-white font-display">
            SupportPilot AI Workspace
          </h2>
          <div className="flex items-center justify-center space-x-2 mt-1">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">
              Enterprise Identity & Auth Console
            </span>
            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[8px] font-mono text-emerald-400 font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>K8S_AUTH_POD: 100% UP</span>
            </span>
          </div>
        </div>

        {/* Dismissible Error Alert */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xxs flex items-start justify-between space-x-2"
            >
              <div className="flex items-start space-x-2">
                <Icons.AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="font-semibold">{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 hover:text-rose-200 p-0.5"
              >
                <Icons.X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Alert Banner */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xxs flex items-start justify-between space-x-2"
            >
              <div className="flex items-start space-x-2">
                <Icons.CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                <span className="font-semibold">{successMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessMessage(null)}
                className="text-emerald-400 hover:text-emerald-200 p-0.5"
              >
                <Icons.X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SMOOTH ANIMATED VIEW MODES */}
        <AnimatePresence mode="wait">
          {/* MODE 1: LOGIN */}
          {mode === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <form onSubmit={handleEmailPasswordLogin} className="space-y-3.5">
                <div className="space-y-1 text-left">
                  <label className="text-[9.5px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Work Email Address</span>
                    <span className="text-indigo-400 text-[8.5px]">SSO & Persistent Token</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="operator@company.com"
                      required
                      className={`w-full rounded-xl border bg-slate-900/90 pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-all ${
                        invalidFields.includes('email')
                          ? 'border-rose-500/80 bg-rose-950/20 shadow-sm shadow-rose-950/50'
                          : 'border-slate-800 focus:border-indigo-500'
                      }`}
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
                      className={`w-full rounded-xl border bg-slate-900/90 pl-9 pr-9 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-all ${
                        invalidFields.includes('password')
                          ? 'border-rose-500/80 bg-rose-950/20 shadow-sm shadow-rose-950/50'
                          : 'border-slate-800 focus:border-indigo-500'
                      }`}
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
                    <span>Persist session token in localStorage</span>
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
                      <span>Sign In & Store Token</span>
                    </>
                  )}
                </button>
              </form>

              {/* Quick Demo Operator Persona Autofill Bar */}
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-2.5 space-y-2 text-left my-3">
                <div className="flex items-center justify-between text-[9px] font-mono font-bold text-indigo-300 uppercase tracking-wider">
                  <span className="flex items-center space-x-1">
                    <Icons.Zap className="h-3 w-3 text-amber-400 animate-pulse" />
                    <span>Demo Operator Sign-In:</span>
                  </span>
                  <span className="text-slate-500 text-[8px]">1-Click Autofill</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-xxs font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('admin@supportpilot.ai');
                      setPassword('admin123');
                      setSuccessMessage('Autofilled Admin credentials. Click Sign In.');
                    }}
                    className="p-1.5 rounded-lg bg-slate-900/90 hover:bg-indigo-600/30 border border-slate-800 text-slate-200 hover:text-white transition-all text-center cursor-pointer flex flex-col items-center"
                    title="Autofill Admin credentials"
                  >
                    <span className="font-bold text-indigo-300 truncate w-full">Admin (Alex)</span>
                    <span className="text-[7.5px] text-slate-400">Admin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEmail('sre.lead@supportpilot.io');
                      setPassword('sre_pass_2026');
                      setSuccessMessage('Autofilled Sarah Chen (Lead SRE) credentials. Click Sign In.');
                    }}
                    className="p-1.5 rounded-lg bg-slate-900/90 hover:bg-indigo-600/30 border border-slate-800 text-slate-200 hover:text-white transition-all text-center cursor-pointer flex flex-col items-center"
                    title="Autofill Lead SRE credentials"
                  >
                    <span className="font-bold text-emerald-300 truncate w-full">Sarah Chen</span>
                    <span className="text-[7.5px] text-slate-400">Lead SRE</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEmail('security.auditor@supportpilot.io');
                      setPassword('sec_pass_2026');
                      setSuccessMessage('Autofilled Marcus Vance (Security Auditor) credentials. Click Sign In.');
                    }}
                    className="p-1.5 rounded-lg bg-slate-900/90 hover:bg-indigo-600/30 border border-slate-800 text-slate-200 hover:text-white transition-all text-center cursor-pointer flex flex-col items-center"
                    title="Autofill Security Auditor credentials"
                  >
                    <span className="font-bold text-amber-300 truncate w-full">Marcus Vance</span>
                    <span className="text-[7.5px] text-slate-400">SecAuditor</span>
                  </button>
                </div>
              </div>

              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800" />
                </div>
                <span className="relative bg-slate-950 px-3 text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                  or sign in with
                </span>
              </div>

              {/* Quick Auth Alternatives */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    setMode('sso_login');
                  }}
                  className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/90 border border-indigo-500/30 hover:bg-indigo-950/40 hover:border-indigo-500/60 transition-all cursor-pointer group"
                  title="Sign in with Enterprise SSO or SAML 2.0"
                >
                  <Icons.ShieldCheck className="h-4 w-4 text-indigo-400 group-hover:scale-110 transition-transform mb-1" />
                  <span className="font-semibold text-[10px] text-slate-200">Enterprise SSO</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    setMode('google_oauth');
                  }}
                  className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 transition-all cursor-pointer group"
                  title="Sign in with Google Workspace OAuth"
                >
                  <Icons.Chrome className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform mb-1" />
                  <span className="font-semibold text-[10px] text-slate-200">Google OAuth</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    setMode('phone_otp');
                  }}
                  className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 transition-all cursor-pointer group"
                  title="Sign in with Phone SMS OTP"
                >
                  <Icons.Smartphone className="h-4 w-4 text-amber-400 group-hover:scale-110 transition-transform mb-1" />
                  <span className="font-semibold text-[10px] text-slate-200">SMS OTP</span>
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

          {/* MODE 2: REGISTRATION */}
          {mode === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="space-y-3.5"
            >
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
                      placeholder="Alex Vance"
                      required
                      className={`w-full rounded-xl border bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none ${
                        invalidFields.includes('regName') ? 'border-rose-500/80 bg-rose-950/20' : 'border-slate-800 focus:border-indigo-500'
                      }`}
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
                      placeholder="alex.vance@company.com"
                      required
                      className={`w-full rounded-xl border bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none ${
                        invalidFields.includes('regEmail') ? 'border-rose-500/80 bg-rose-950/20' : 'border-slate-800 focus:border-indigo-500'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-left">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                      Assigned Pod
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
                    <div className="relative">
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        className={`w-full rounded-xl border bg-slate-900 pr-8 pl-3 py-2 text-xs text-white focus:outline-none ${
                          invalidFields.includes('regPassword') ? 'border-rose-500/80 bg-rose-950/20' : 'border-slate-800 focus:border-indigo-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                      >
                        {showRegPassword ? <Icons.EyeOff className="h-3.5 w-3.5" /> : <Icons.Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showRegConfirmPassword ? 'text' : 'password'}
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        className={`w-full rounded-xl border bg-slate-900 pr-8 pl-3 py-2 text-xs text-white focus:outline-none ${
                          invalidFields.includes('regConfirmPassword') ? 'border-rose-500/80 bg-rose-950/20' : 'border-slate-800 focus:border-indigo-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                      >
                        {showRegConfirmPassword ? <Icons.EyeOff className="h-3.5 w-3.5" /> : <Icons.Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2FA Wizard Opt-In */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-left">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center space-x-2">
                      <Icons.QrCode className="h-4 w-4 text-indigo-400" />
                      <div>
                        <div className="text-xs font-bold text-white">Enroll in 2FA Setup Wizard</div>
                        <div className="text-[9px] text-slate-400">Generates QR code for Authenticator App</div>
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
                    I agree to the <span className="text-indigo-400 font-semibold">Security Compliance Terms</span> and session persistence rules.
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
                      <span>{regEnable2FA ? 'Continue to 2FA Wizard' : 'Create Operator Account'}</span>
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

          {/* MODE 3: FORGOT PASSWORD RECOVERY FLOW */}
          {mode === 'forgot_password' && (
            <motion.div
              key="forgot_password"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {!resetSent ? (
                <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
                  <div className="text-center">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mb-2">
                      <Icons.KeyRound className="h-5 w-5" />
                    </div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Account Password Recovery</h3>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Enter your registered work email to receive a simulated password recovery email and validation token.
                    </p>
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-[9.5px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                      Work Email Address
                    </label>
                    <input
                      type="email"
                      value={forgotEmailOrPhone}
                      onChange={(e) => setForgotEmailOrPhone(e.target.value)}
                      placeholder="operator@company.com"
                      required
                      className={`w-full rounded-xl border bg-slate-900 px-3 py-2.5 text-xs text-white focus:outline-none ${
                        invalidFields.includes('forgotEmailOrPhone') ? 'border-rose-500 bg-rose-950/20' : 'border-slate-800 focus:border-indigo-500'
                      }`}
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
                        <Icons.Send className="h-4 w-4" />
                        <span>Send Recovery Email & Reset Token</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleCompletePasswordReset} className="space-y-3.5">
                  <div className="text-center">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Complete Password Reset</h3>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Dispatched recovery token to <span className="text-indigo-300 font-mono">{forgotEmailOrPhone}</span>
                    </p>
                  </div>

                  {/* Simulated Email Notification Preview Card */}
                  {showEmailInboxPreview && (
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-indigo-500/40 space-y-2 text-left relative overflow-hidden">
                      <div className="flex items-center justify-between text-xxs font-mono text-indigo-400 border-b border-slate-800 pb-1.5">
                        <span className="flex items-center space-x-1.5">
                          <Icons.Mail className="h-3.5 w-3.5 text-indigo-400" />
                          <span className="font-bold">Simulated Email Dispatched</span>
                        </span>
                        <span className="text-emerald-400 font-bold">DELIVERED</span>
                      </div>
                      <div className="text-xxs space-y-1 font-mono text-slate-300">
                        <div><span className="text-slate-500">From:</span> security-gate@supportpilot.ai</div>
                        <div><span className="text-slate-500">Subject:</span> SupportPilot AI Password Reset Token</div>
                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 mt-1 flex items-center justify-between">
                          <div>
                            <div className="text-[9px] text-slate-400">Your Validation Token:</div>
                            <div className="text-xs font-bold text-emerald-400 font-mono tracking-wider">{dispatchedResetToken}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setInputResetToken(dispatchedResetToken)}
                            className="px-2 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-[9px] font-mono border border-indigo-500/30 cursor-pointer"
                          >
                            Use Token
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1 text-left">
                    <label className="text-[9.5px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                      Validation Token
                    </label>
                    <input
                      type="text"
                      value={inputResetToken}
                      onChange={(e) => setInputResetToken(e.target.value)}
                      placeholder="RESET-TOK-8942-X9"
                      required
                      className={`w-full rounded-xl border bg-slate-900 px-3 py-2 text-center font-mono text-sm font-bold text-indigo-300 focus:outline-none ${
                        invalidFields.includes('inputResetToken') ? 'border-rose-500 bg-rose-950/20' : 'border-slate-800 focus:border-indigo-500'
                      }`}
                    />
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-[9.5px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        className={`w-full rounded-xl border bg-slate-900 pr-9 pl-3 py-2 text-xs text-white focus:outline-none ${
                          invalidFields.includes('newPassword') ? 'border-rose-500 bg-rose-950/20' : 'border-slate-800 focus:border-indigo-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                      >
                        {showNewPassword ? <Icons.EyeOff className="h-3.5 w-3.5" /> : <Icons.Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-[9.5px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmNewPassword ? 'text' : 'password'}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        className={`w-full rounded-xl border bg-slate-900 pr-9 pl-3 py-2 text-xs text-white focus:outline-none ${
                          invalidFields.includes('confirmNewPassword') ? 'border-rose-500 bg-rose-950/20' : 'border-slate-800 focus:border-indigo-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                      >
                        {showConfirmNewPassword ? <Icons.EyeOff className="h-3.5 w-3.5" /> : <Icons.Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
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
                        <span>Update Password & Return to Login</span>
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

          {/* MODE 4: 2FA SETUP WIZARD (TOTP ENROLLMENT) */}
          {mode === '2fa_setup' && (
            <motion.div
              key="2fa_setup"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="text-center">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mb-2">
                  <Icons.QrCode className="h-5 w-5" />
                </div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">2FA Setup & Enrollment Wizard</h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  Scan the QR code with Google Authenticator or Authy to configure Multi-Factor Security.
                </p>
              </div>

              {/* Simulated Vector QR Code Display */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center space-y-3 relative">
                <div className="p-3 bg-white rounded-xl shadow-lg border border-slate-700 relative">
                  <svg className="w-28 h-28" viewBox="0 0 100 100" fill="none">
                    {/* Simulated SVG QR Code pattern */}
                    <rect width="100" height="100" fill="white" />
                    {/* Position indicators */}
                    <rect x="5" y="5" width="30" height="30" fill="black" />
                    <rect x="10" y="10" width="20" height="20" fill="white" />
                    <rect x="15" y="15" width="10" height="10" fill="black" />

                    <rect x="65" y="5" width="30" height="30" fill="black" />
                    <rect x="70" y="10" width="20" height="20" fill="white" />
                    <rect x="75" y="15" width="10" height="10" fill="black" />

                    <rect x="5" y="65" width="30" height="30" fill="black" />
                    <rect x="10" y="70" width="20" height="20" fill="white" />
                    <rect x="15" y="75" width="10" height="10" fill="black" />

                    {/* Data matrix dots */}
                    <rect x="40" y="10" width="15" height="5" fill="black" />
                    <rect x="45" y="20" width="10" height="10" fill="black" />
                    <rect x="10" y="40" width="25" height="10" fill="black" />
                    <rect x="40" y="40" width="20" height="20" fill="black" />
                    <rect x="65" y="40" width="25" height="10" fill="black" />
                    <rect x="40" y="65" width="15" height="15" fill="black" />
                    <rect x="65" y="65" width="10" height="25" fill="black" />
                    <rect x="80" y="80" width="15" height="15" fill="black" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md">
                      <Icons.ShieldCheck className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                <div className="w-full text-center space-y-1">
                  <div className="text-[9px] text-slate-400 font-mono uppercase">Or enter Secret Key manually:</div>
                  <div className="flex items-center justify-center space-x-2">
                    <code className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-indigo-300 font-mono text-xs font-bold tracking-wider">
                      {setup2FASecret}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(setup2FASecret);
                        setIsCopiedSecret(true);
                        setTimeout(() => setIsCopiedSecret(false), 2000);
                      }}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
                      title="Copy Secret Key"
                    >
                      {isCopiedSecret ? <Icons.Check className="h-3.5 w-3.5 text-emerald-400" /> : <Icons.Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Code Verification Form */}
              <form onSubmit={handleComplete2FASetup} className="space-y-3">
                <div className="space-y-1 text-center">
                  <label className="text-[9.5px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                    Enter 6-Digit TOTP Code to Verify
                  </label>
                  <div className="flex justify-center space-x-2 py-1">
                    {setup2FACode.map((digit, idx) => (
                      <input
                        key={idx}
                        id={`setup2fa-${idx}`}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => {
                          const val = e.target.value;
                          const newCode = [...setup2FACode];
                          newCode[idx] = val;
                          setSetup2FACode(newCode);
                          if (val && idx < 5) {
                            const nextInput = document.getElementById(`setup2fa-${idx + 1}`);
                            if (nextInput) nextInput.focus();
                          }
                        }}
                        className={`w-9 h-11 rounded-xl border bg-slate-900 text-center font-mono text-base font-bold text-indigo-300 focus:outline-none ${
                          invalidFields.includes('setup2FACode') ? 'border-rose-500 bg-rose-950/20' : 'border-slate-800 focus:border-indigo-500'
                        }`}
                      />
                    ))}
                  </div>
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
                      <Icons.ShieldCheck className="h-4 w-4" />
                      <span>Verify & Enable Multi-Factor Auth</span>
                    </>
                  )}
                </button>
              </form>

              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full rounded-xl bg-slate-900 border border-slate-800 py-2.5 text-xs text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                Skip 2FA Setup for Now
              </button>
            </motion.div>
          )}

          {/* MODE 5: GOOGLE OAUTH */}
          {mode === 'google_oauth' && (
            <motion.div
              key="google_oauth"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
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
                  <button
                    type="button"
                    onClick={() => handleGoogleOAuthSelect('admin@supportpilot.ai', 'Alex Vance (Admin)')}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/50 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center space-x-3">
                      <img
                        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80"
                        alt="Alex Vance"
                        className="h-8 w-8 rounded-full border border-indigo-500/30 object-cover"
                      />
                      <div>
                        <div className="text-xs font-bold text-white group-hover:text-indigo-300">
                          Alex Vance (Admin)
                        </div>
                        <div className="text-[9px] font-mono text-slate-400">admin@supportpilot.ai</div>
                      </div>
                    </div>
                    <Icons.ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-indigo-400" />
                  </button>

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

          {/* MODE 6: PHONE SMS OTP */}
          {mode === 'phone_otp' && (
            <motion.div
              key="phone_otp"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
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
                        className={`flex-1 rounded-xl border bg-slate-900 px-3 py-2.5 text-xs text-white focus:outline-none ${
                          invalidFields.includes('phoneNum') ? 'border-rose-500 bg-rose-950/20' : 'border-slate-800 focus:border-indigo-500'
                        }`}
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
                        className={`w-10 h-12 rounded-xl border bg-slate-900 text-center font-mono text-base font-bold text-indigo-300 focus:outline-none ${
                          invalidFields.includes('otpCode') ? 'border-rose-500 bg-rose-950/20' : 'border-slate-800 focus:border-indigo-500'
                        }`}
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

          {/* MODE 7: 2FA CHALLENGE VERIFICATION */}
          {mode === '2fa_verify' && (
            <motion.div
              key="2fa_verify"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mb-2">
                  <Icons.ShieldCheck className="h-6 w-6 animate-pulse" />
                </div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Two-Factor Security Verification
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  Enter the 6-digit verification code from your <span className="text-indigo-300 font-semibold">Authenticator App</span>.
                </p>
              </div>

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
                      className={`w-10 h-12 rounded-xl border bg-slate-900 text-center font-mono text-base font-bold text-indigo-300 focus:outline-none ${
                        invalidFields.includes('twoFactorCode') ? 'border-rose-500 bg-rose-950/20' : 'border-slate-800 focus:border-indigo-500'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-xxs text-slate-400 font-mono">
                  <span>Verification Window: 30s</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTwoFactorCode(['8', '4', '9', '2', '0', '1']);
                      setSuccessMessage('Autofilled active demo 2FA challenge code (849201).');
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
                      <span>Authorize Session & Store Token</span>
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

          {/* MODE: ENTERPRISE SSO / SAML 2.0 */}
          {mode === 'sso_login' && (
            <motion.div
              key="sso_login"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="text-center">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mb-2">
                  <Icons.Key className="h-5 w-5" />
                </div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Enterprise Single Sign-On (SSO / SAML 2.0)</h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  Authenticate using your corporate Okta, Azure AD, or Ping Identity portal.
                </p>
              </div>

              {/* Provider Selection */}
              <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    setSsoProvider('okta');
                    setSsoDomain('supportpilot.okta.com');
                  }}
                  className={`py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    ssoProvider === 'okta' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Okta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSsoProvider('microsoft');
                    setSsoDomain('corp.microsoft.com');
                  }}
                  className={`py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    ssoProvider === 'microsoft' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Azure AD
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSsoProvider('google');
                    setSsoDomain('workspace.supportpilot.io');
                  }}
                  className={`py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    ssoProvider === 'google' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  GWorkspace
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSsoProvider('ping');
                    setSsoDomain('sso.pingfederate.com');
                  }}
                  className={`py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    ssoProvider === 'ping' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  PingID
                </button>
              </div>

              <form onSubmit={handleSsoLogin} className="space-y-3">
                <div className="space-y-1 text-left">
                  <label className="text-[9.5px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Identity Domain URL</span>
                    <span className="text-indigo-400 text-[8.5px]">SAML 2.0 / OAuth 2.0</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={ssoDomain}
                      onChange={(e) => setSsoDomain(e.target.value)}
                      placeholder="company.okta.com"
                      required
                      className={`w-full rounded-xl border bg-slate-900/90 pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-all ${
                        invalidFields.includes('ssoDomain') ? 'border-rose-500 bg-rose-950/20' : 'border-slate-800 focus:border-indigo-500'
                      }`}
                    />
                    <Icons.Globe className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  </div>
                </div>

                {/* 1-Click Domain Presets */}
                <div className="flex items-center space-x-1.5 text-[8.5px] font-mono text-slate-400 flex-wrap gap-y-1">
                  <span className="uppercase text-slate-500">Presets:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSsoProvider('okta');
                      setSsoDomain('supportpilot.okta.com');
                    }}
                    className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-indigo-500/50 text-indigo-300 cursor-pointer"
                  >
                    supportpilot.okta.com
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSsoProvider('microsoft');
                      setSsoDomain('sso.corp.io');
                    }}
                    className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-indigo-500/50 text-indigo-300 cursor-pointer"
                  >
                    sso.corp.io
                  </button>
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
                      <span>Authenticate via {ssoProvider.toUpperCase()} SSO</span>
                    </>
                  )}
                </button>
              </form>

              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full rounded-xl bg-slate-900 border border-slate-800 py-2.5 text-xs text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                Back to Standard Login Options
              </button>
            </motion.div>
          )}

          {/* MODE: SMOOTH SUCCESS STATE ANIMATION */}
          {mode === 'success_state' && successUserData && (
            <motion.div
              key="success_state"
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="py-6 space-y-5 text-center flex flex-col items-center justify-center"
            >
              {/* Centered Glowing Checkmark badge with pulsing concentric rings */}
              <div className="relative flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.8, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                  className="absolute rounded-full bg-emerald-500/20 blur-xl w-24 h-24"
                />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="h-20 w-20 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-xl shadow-emerald-500/20 relative z-10"
                >
                  <Icons.CheckCircle2 className="h-10 w-10 text-emerald-400" />
                </motion.div>
              </div>

              {/* Title & Badge */}
              <div className="space-y-1">
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-mono font-bold uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>AUTHENTICATION SUCCESSFUL</span>
                </div>
                <h3 className="text-base font-black text-white font-display uppercase tracking-wide pt-1">
                  Welcome Back, {successUserData.name.split(' ')[0]}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  Persistent session token established for {successUserData.email}
                </p>
              </div>

              {/* User Identity Preview Card */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="w-full rounded-xl bg-slate-900/90 border border-slate-800 p-3 flex items-center space-x-3 text-left shadow-lg"
              >
                <img
                  src={successUserData.avatar}
                  alt={successUserData.name}
                  className="h-10 w-10 rounded-xl object-cover border border-emerald-500/40 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">{successUserData.name}</div>
                  <div className="text-[9.5px] text-slate-400 truncate">{successUserData.role}</div>
                  <div className="flex items-center space-x-2 text-[8.5px] font-mono text-indigo-300 mt-0.5">
                    <span className="truncate">{successUserData.pod}</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-bold uppercase">{successAuthMethod.toUpperCase()}</span>
                  </div>
                </div>
              </motion.div>

              {/* Animated Token & Workspace Launch Progress Bar */}
              <div className="w-full space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
                  <span className="flex items-center space-x-1">
                    <Icons.Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
                    <span>Launching SupportPilot AI Workspace...</span>
                  </span>
                  <span className="text-emerald-400 font-bold">100% READY</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.2, ease: 'easeInOut' }}
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 rounded-full"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
