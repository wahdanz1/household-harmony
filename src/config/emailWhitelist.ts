// Email whitelist for user approval
// Only emails in this list can access the application

export const ALLOWED_EMAILS = [
    // Add allowed email addresses here
    "damandropdead@gmail.com", // Replace with your actual email
    // "friend@example.com", // Add more emails as needed
];

export const isEmailAllowed = (email: string): boolean => {
    return ALLOWED_EMAILS.includes(email.toLowerCase());
};
