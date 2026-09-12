const {
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
  ALLOWED_DEPARTMENTS,
  CATEGORY_TO_DEPARTMENT,
  DEPARTMENT_ALIASES,
} = require("../constants");

const normalizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const pickAllowed = (value, allowed) => {
  const raw = String(value || "").trim();

  if (!raw) {
    return null;
  }

  const exact = allowed.find(
    (item) => item.toLowerCase() === raw.toLowerCase()
  );

  if (exact) {
    return exact;
  }

  const compact = normalizeKey(raw);

  return (
    allowed.find((item) => normalizeKey(item) === compact) || null
  );
};

const normalizeDepartment = (value, category) => {
  const raw = String(value || "").trim();
  const alias =
    DEPARTMENT_ALIASES[normalizeKey(raw)] ||
    pickAllowed(raw, ALLOWED_DEPARTMENTS);

  if (alias && ALLOWED_DEPARTMENTS.includes(alias)) {
    return alias;
  }

  if (category && CATEGORY_TO_DEPARTMENT[category]) {
    return CATEGORY_TO_DEPARTMENT[category];
  }

  return null;
};

const normalizePriority = (value) => {
  const mapped = pickAllowed(value, ALLOWED_PRIORITIES);

  if (mapped) {
    return mapped;
  }

  const compact = normalizeKey(value);

  if (["critical", "severe", "emergency"].includes(compact)) {
    return "Urgent";
  }

  if (["high", "important"].includes(compact)) {
    return "High";
  }

  if (["low", "minor"].includes(compact)) {
    return "Low";
  }

  return "Medium";
};

const normalizeSummary = (value) => {
  const summary = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!summary) {
    return null;
  }

  return summary.slice(0, 180);
};

const validateComplaintAnalysis = (payload) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const category = pickAllowed(payload.category, ALLOWED_CATEGORIES);

  if (!category) {
    return null;
  }

  const priority = normalizePriority(payload.priority);
  const recommendedDepartment = normalizeDepartment(
    payload.recommendedDepartment || payload.department,
    category
  );
  const summary = normalizeSummary(payload.summary);

  if (!recommendedDepartment || !summary) {
    return null;
  }

  const visualObservations = Array.isArray(payload.visualObservations)
    ? payload.visualObservations
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, 4)
    : undefined;

  return {
    category,
    priority,
    recommendedDepartment,
    summary,
    ...(visualObservations ? { visualObservations } : {}),
  };
};

module.exports = {
  validateComplaintAnalysis,
  pickAllowed,
};
