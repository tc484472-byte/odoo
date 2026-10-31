// Input Validation Helper

function isValidPassword(password) {
  if (!password || typeof password !== 'string') return false;
  // Min 8 characters, uppercase, lowercase, and special character
  const minLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  return minLength && hasUpper && hasLower && hasSpecial;
}

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

function validatePasswordMiddleware(req, res, next) {
  const { password } = req.body;
  if (!isValidPassword(password)) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.'
    });
  }
  next();
}

function validateEmailMiddleware(req, res, next) {
  const { email } = req.body;
  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address.'
    });
  }
  next();
}

module.exports = {
  isValidPassword,
  isValidEmail,
  validatePasswordMiddleware,
  validateEmailMiddleware
};
