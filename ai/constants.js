const ALLOWED_CATEGORIES = [
  "Electrical",
  "Plumbing",
  "Internet",
  "Cleanliness",
  "Furniture",
  "Security",
  "Other",
];

const ALLOWED_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const ALLOWED_DEPARTMENTS = [
  "Electrical Department",
  "Hostel Warden",
  "Cleaning Staff",
  "IT Support",
  "Security Team",
  "Maintenance Team",
];

const CATEGORY_TO_DEPARTMENT = {
  Electrical: "Electrical Department",
  Plumbing: "Maintenance Team",
  Internet: "IT Support",
  Cleanliness: "Cleaning Staff",
  Furniture: "Maintenance Team",
  Security: "Security Team",
  Other: "Hostel Warden",
};

const DEPARTMENT_ALIASES = {
  electrical: "Electrical Department",
  "electrical department": "Electrical Department",
  electricity: "Electrical Department",
  lighting: "Electrical Department",
  plumbing: "Maintenance Team",
  maintenance: "Maintenance Team",
  "maintenance team": "Maintenance Team",
  "maintenance department": "Maintenance Team",
  furniture: "Maintenance Team",
  internet: "IT Support",
  wifi: "IT Support",
  "wi-fi": "IT Support",
  it: "IT Support",
  "it support": "IT Support",
  "it department": "IT Support",
  cleanliness: "Cleaning Staff",
  cleaning: "Cleaning Staff",
  "cleaning staff": "Cleaning Staff",
  housekeeping: "Cleaning Staff",
  security: "Security Team",
  "security team": "Security Team",
  hostel: "Hostel Warden",
  warden: "Hostel Warden",
  "hostel warden": "Hostel Warden",
};

const AI_UNAVAILABLE_MESSAGE =
  "AI unavailable. You can continue submitting the complaint manually.";

module.exports = {
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
  ALLOWED_DEPARTMENTS,
  CATEGORY_TO_DEPARTMENT,
  DEPARTMENT_ALIASES,
  AI_UNAVAILABLE_MESSAGE,
};
