/**
 * WhatsApp Utility Functions
 * Generate dynamic messages and wa.me deep links for reminders
 */

/**
 * Format currency for message
 */
const formatCurrency = (value) => {
  return Number(value || 0).toLocaleString("ne-NP", {
    style: "currency",
    currency: "NPR",
    minimumFractionDigits: 0,
  });
};

/**
 * Generate debt reminder message
 * @param {Object} params - { friendName, amount, type: "LENT" | "BORROWED" }
 * @returns {string} Message text
 */
export const generateDebtReminderMessage = ({ friendName, amount, type }) => {
  const formattedAmount = formatCurrency(amount);
  
  if (type === "LENT") {
    return `Hi ${friendName}, just a friendly reminder that you owe me ${formattedAmount}. Please settle when you get a chance. Thanks!`;
  }
  
  return `Hi ${friendName}, I just wanted to remind you that I owe you ${formattedAmount}. I'll get it sorted soon. Thank you!`;
};

/**
 * Generate item return reminder message
 * @param {Object} params - { friendName, itemName }
 * @returns {string} Message text
 */
export const generateItemReminderMessage = ({ friendName, itemName }) => {
  return `Hi ${friendName}, I hope you're enjoying the ${itemName}. Please return it when you get a chance. Thanks!`;
};

/**
 * Generate wa.me link with encoded message
 * @param {string} phoneNumber - Phone number with country code (e.g., 977xxxxxxxxxx)
 * @param {string} message - Message text
 * @returns {string} wa.me URL
 */
export const generateWhatsAppLink = (phoneNumber, message) => {
  if (!phoneNumber) return null;
  
  // Remove any non-digit characters and ensure country code
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  const encoded = encodeURIComponent(message);
  
  return `https://wa.me/${cleanPhone}?text=${encoded}`;
};

/**
 * Open WhatsApp message in new tab
 * @param {string} phoneNumber - Phone number with country code
 * @param {string} message - Message text
 */
export const openWhatsAppChat = (phoneNumber, message) => {
  const link = generateWhatsAppLink(phoneNumber, message);
  if (link) {
    window.open(link, "_blank", "noopener,noreferrer");
  }
};

/**
 * Send debt reminder via WhatsApp
 * @param {Object} params - { phoneNumber, friendName, amount, type }
 */
export const sendDebtReminder = ({ phoneNumber, friendName, amount, type }) => {
  const message = generateDebtReminderMessage({ friendName, amount, type });
  openWhatsAppChat(phoneNumber, message);
};

/**
 * Send item return reminder via WhatsApp
 * @param {Object} params - { phoneNumber, friendName, itemName }
 */
export const sendItemReminder = ({ phoneNumber, friendName, itemName }) => {
  const message = generateItemReminderMessage({ friendName, itemName });
  openWhatsAppChat(phoneNumber, message);
};

export default {
  generateDebtReminderMessage,
  generateItemReminderMessage,
  generateWhatsAppLink,
  openWhatsAppChat,
  sendDebtReminder,
  sendItemReminder,
};
