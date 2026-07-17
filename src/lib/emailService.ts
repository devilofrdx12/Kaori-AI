import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendPasswordResetEmail(email: string, otp: string, resetUrl: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Password reset email is not configured");
    }

    // Never put reset codes, recipient addresses, or reset URLs in logs.
    console.warn("Password reset email was not delivered because SMTP is not configured.");
    return;
  }

  const mailOptions = {
    from: `"Kaori AI" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Password Reset Request - Kaori AI`,
    text: `You requested a password reset for your Kaori AI account.\n\nYour reset code is: ${otp}\n\nEnter this code at ${resetUrl}\n\nThis code will expire in 10 minutes. If you did not request this, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your Kaori AI account.</p>
        <p>Use this one-time code to reset your password:</p>
        <div style="font-size: 32px; letter-spacing: 8px; font-weight: 700; padding: 16px 20px; margin: 20px 0; background: #f3f4f6; border-radius: 8px; text-align: center; color: #111827;">${otp}</div>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; color: white; background-color: #007bff; text-decoration: none; border-radius: 5px; margin: 20px 0;">Reset Password</a>
        <p>Or copy and paste this page into your browser:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p style="color: #d9534f; font-weight: bold;">This code will expire in 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}
