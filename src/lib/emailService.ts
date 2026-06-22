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

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  if (!process.env.SMTP_USER) {
    console.log('No SMTP configured. Email simulation:');
    console.log(`Password reset email would be sent to: ${email}`);
    console.log(`Reset URL: ${resetUrl}`);
    return;
  }

  const mailOptions = {
    from: `"Kaori AI" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Password Reset Request - Kaori AI`,
    text: `You requested a password reset. Please click the link below to reset your password. \n\n${resetUrl}\n\nThis link will expire in 1 minute and 30 seconds. If you did not request this, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your Kaori AI account.</p>
        <p>Please click the button below to reset your password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; color: white; background-color: #007bff; text-decoration: none; border-radius: 5px; margin: 20px 0;">Reset Password</a>
        <p>Or copy and paste this link into your browser:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p style="color: #d9534f; font-weight: bold;">This link will expire in 1 minute and 30 seconds.</p>
        <p>If you did not request this, please ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}
