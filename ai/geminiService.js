const db = require("../config/db");
const { generateContent, isGeminiConfigured } = require("./geminiClient");
const { AI_UNAVAILABLE_MESSAGE } = require("./constants");
const { validateComplaintAnalysis } = require("./validators/complaintAnalysis");
const { getComplaintAnalyzerPrompt } = require("./prompts/complaintAnalyzer");
const { getImageAnalyzerPrompt } = require("./prompts/imageAnalyzer");
const { getSimilarComplaintsPrompt } = require("./prompts/similarComplaints");
const { getAdminInsightsPrompt } = require("./prompts/adminInsights");
const { getIssueClusteringPrompt } = require("./prompts/issueClustering");

const mapGeminiError = (error) => {
  const code = error?.code;

  if (code === "GEMINI_NOT_CONFIGURED") {
    return {
      status: 503,
      message: AI_UNAVAILABLE_MESSAGE,
    };
  }

  if (code === "GEMINI_TIMEOUT" || code === "GEMINI_NETWORK") {
    return {
      status: 503,
      message: AI_UNAVAILABLE_MESSAGE,
    };
  }

  if (code === "GEMINI_RATE_LIMIT") {
    return {
      status: 429,
      message:
        "CampusFix AI is busy right now. Please wait a moment and try again, or continue manually.",
    };
  }

  return {
    status: 503,
    message: AI_UNAVAILABLE_MESSAGE,
  };
};

const requireGemini = () => {
  if (!isGeminiConfigured()) {
    const error = new Error(AI_UNAVAILABLE_MESSAGE);
    error.code = "GEMINI_NOT_CONFIGURED";
    throw error;
  }
};

const analyzeComplaintText = async ({ text, title, location }) => {
  requireGemini();

  const prompt = getComplaintAnalyzerPrompt({
    text,
    title,
    location,
  });

  const result = await generateContent({
    systemInstruction: prompt.systemInstruction,
    parts: [{ text: prompt.userText }],
  });

  const analysis = validateComplaintAnalysis(result.json);

  if (!analysis) {
    const error = new Error(
      "CampusFix AI could not produce a valid recommendation. You can continue submitting the complaint manually."
    );
    error.code = "GEMINI_INVALID_JSON";
    throw error;
  }

  return analysis;
};

const analyzeComplaintImage = async ({
  imageBuffer,
  mimeType,
  text,
  title,
  location,
}) => {
  requireGemini();

  const prompt = getImageAnalyzerPrompt({
    text,
    title,
    location,
  });

  const result = await generateContent({
    systemInstruction: prompt.systemInstruction,
    parts: [
      { text: prompt.userText },
      {
        inlineData: {
          mimeType,
          data: imageBuffer.toString("base64"),
        },
      },
    ],
  });

  const analysis = validateComplaintAnalysis(result.json);

  if (!analysis) {
    const error = new Error(
      "CampusFix AI could not assess this image. You can continue submitting the complaint manually."
    );
    error.code = "GEMINI_INVALID_JSON";
    throw error;
  }

  return {
    ...analysis,
    visualObservations: analysis.visualObservations || [],
  };
};

const findSimilarComplaints = async ({
  title,
  description,
  location,
  category,
}) => {
  requireGemini();

  const [candidates] = await db.query(
    `SELECT
       id,
       reference_number,
       title,
       category,
       location,
       status,
       LEFT(description, 280) AS description
     FROM complaints
     WHERE status IN ('Raised', 'In Progress')
     ORDER BY created_at DESC
     LIMIT 25`
  );

  if (!candidates.length) {
    return [];
  }

  const prompt = getSimilarComplaintsPrompt({
    draft: {
      title: title || "",
      description,
      location: location || "",
      category: category || "",
    },
    candidates: candidates.map((row) => ({
      complaintId: row.id,
      referenceNumber: row.reference_number,
      title: row.title,
      category: row.category,
      location: row.location,
      status: row.status,
      description: row.description,
    })),
  });

  const result = await generateContent({
    systemInstruction: prompt.systemInstruction,
    parts: [{ text: prompt.userText }],
  });

  const rawMatches = Array.isArray(result.json?.matches)
    ? result.json.matches
    : [];

  const byId = new Map(
    candidates.map((row) => [Number(row.id), row])
  );

  const matches = [];

  for (const item of rawMatches) {
    const complaintId = Number(item.complaintId || item.id);
    const existing = byId.get(complaintId);

    if (!existing) {
      continue;
    }

    matches.push({
      complaintId: existing.id,
      referenceNumber: existing.reference_number,
      title: existing.title,
      status: existing.status,
      similarityReason:
        String(item.similarityReason || "").trim() ||
        "This appears related to the same campus issue.",
    });

    if (matches.length >= 5) {
      break;
    }
  }

  return matches;
};

const gatherInsightData = async () => {
  const [summaryRows] = await db.query(`
    SELECT
      COUNT(*) AS total_complaints,
      SUM(status = 'Raised') AS raised,
      SUM(status = 'In Progress') AS in_progress,
      SUM(status = 'Resolved') AS resolved,
      SUM(status <> 'Resolved') AS unresolved,
      SUM(
        due_at IS NOT NULL
        AND due_at < NOW()
        AND status <> 'Resolved'
      ) AS overdue
    FROM complaints
  `);

  const [weekRows] = await db.query(`
    SELECT
      SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS created_last_7_days,
      SUM(
        status <> 'Resolved'
        AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      ) AS unresolved_created_last_7_days,
      SUM(
        resolved_at IS NOT NULL
        AND resolved_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      ) AS resolved_last_7_days
    FROM complaints
  `);

  const [categoryRows] = await db.query(`
    SELECT
      category,
      COUNT(*) AS total,
      SUM(status <> 'Resolved') AS unresolved
    FROM complaints
    GROUP BY category
    ORDER BY unresolved DESC, total DESC
  `);

  const [locationRows] = await db.query(`
    SELECT
      location,
      COUNT(*) AS total,
      SUM(status <> 'Resolved') AS unresolved
    FROM complaints
    WHERE location IS NOT NULL
      AND TRIM(location) <> ''
    GROUP BY location
    ORDER BY unresolved DESC, total DESC
    LIMIT 8
  `);

  const [priorityRows] = await db.query(`
    SELECT
      priority,
      COUNT(*) AS total,
      SUM(status <> 'Resolved') AS unresolved
    FROM complaints
    GROUP BY priority
  `);

  const [departmentRows] = await db.query(`
    SELECT
      COALESCE(assigned_department, 'Unassigned') AS department,
      COUNT(*) AS total,
      SUM(status <> 'Resolved') AS unresolved
    FROM complaints
    GROUP BY assigned_department
    ORDER BY unresolved DESC
    LIMIT 8
  `);

  const [sampleRows] = await db.query(`
    SELECT
      reference_number,
      title,
      category,
      location,
      status,
      priority
    FROM complaints
    WHERE status <> 'Resolved'
    ORDER BY
      FIELD(priority, 'Urgent', 'High', 'Medium', 'Low'),
      created_at DESC
    LIMIT 12
  `);

  const toNumber = (value) => Number(value) || 0;

  return {
    generatedFromDatabaseAt: new Date().toISOString(),
    totals: {
      totalComplaints: toNumber(summaryRows[0]?.total_complaints),
      raised: toNumber(summaryRows[0]?.raised),
      inProgress: toNumber(summaryRows[0]?.in_progress),
      resolved: toNumber(summaryRows[0]?.resolved),
      unresolved: toNumber(summaryRows[0]?.unresolved),
      overdue: toNumber(summaryRows[0]?.overdue),
    },
    last7Days: {
      created: toNumber(weekRows[0]?.created_last_7_days),
      unresolvedCreated: toNumber(
        weekRows[0]?.unresolved_created_last_7_days
      ),
      resolved: toNumber(weekRows[0]?.resolved_last_7_days),
    },
    byCategory: categoryRows.map((row) => ({
      category: row.category,
      total: toNumber(row.total),
      unresolved: toNumber(row.unresolved),
    })),
    topLocations: locationRows.map((row) => ({
      location: row.location,
      total: toNumber(row.total),
      unresolved: toNumber(row.unresolved),
    })),
    byPriority: priorityRows.map((row) => ({
      priority: row.priority,
      total: toNumber(row.total),
      unresolved: toNumber(row.unresolved),
    })),
    byDepartment: departmentRows.map((row) => ({
      department: row.department,
      total: toNumber(row.total),
      unresolved: toNumber(row.unresolved),
    })),
    sampleOpenComplaints: sampleRows.map((row) => ({
      referenceNumber: row.reference_number,
      title: row.title,
      category: row.category,
      location: row.location,
      status: row.status,
      priority: row.priority,
    })),
  };
};

const buildFallbackUsedDataSummary = (data) => {
  const lines = [
    `• Total complaints: ${data.totals.totalComplaints}`,
    `• Unresolved: ${data.totals.unresolved}`,
    `• Overdue: ${data.totals.overdue}`,
    `• Created in last 7 days: ${data.last7Days.created}`,
  ];

  data.byCategory.slice(0, 4).forEach((row) => {
    lines.push(
      `• ${row.category}: ${row.total} total, ${row.unresolved} unresolved`
    );
  });

  data.topLocations.slice(0, 3).forEach((row) => {
    lines.push(
      `• ${row.location}: ${row.unresolved} unresolved`
    );
  });

  return lines.join("\n");
};

const answerAdminInsights = async (question) => {
  requireGemini();

  const data = await gatherInsightData();

  if (data.totals.totalComplaints === 0) {
    return {
      answer:
        "There is insufficient data to generate campus insights. No complaints are stored in the database yet.",
      usedDataSummary: "• Total complaints: 0",
      generatedAt: new Date().toISOString(),
    };
  }

  const prompt = getAdminInsightsPrompt({
    question,
    data,
  });

  const result = await generateContent({
    systemInstruction: prompt.systemInstruction,
    parts: [{ text: prompt.userText }],
    maxOutputTokens: 2048,
  });

  const answer = String(result.json?.answer || "").trim();
  const usedDataSummary = String(
    result.json?.usedDataSummary || ""
  ).trim();

  if (!answer) {
    const error = new Error(
      "CampusFix AI could not generate insights right now."
    );
    error.code = "GEMINI_EMPTY";
    throw error;
  }

  return {
    answer,
    usedDataSummary: usedDataSummary || buildFallbackUsedDataSummary(data),
    generatedAt: new Date().toISOString(),
  };
};

const clusterComplaints = async () => {
  const [candidates] = await db.query(
    `SELECT
       id,
       reference_number,
       title,
       category,
       location,
       priority,
       LEFT(description, 200) AS description
     FROM complaints
     WHERE status IN ('Raised', 'In Progress')
     ORDER BY created_at DESC
     LIMIT 50`
  );

  if (candidates.length < 2) {
    return {
      clusters: [],
      generatedAt: new Date().toISOString(),
    };
  }

  requireGemini();

  const prompt = getIssueClusteringPrompt({
    complaints: candidates.map((row) => ({
      complaintId: row.id,
      referenceNumber: row.reference_number,
      title: row.title,
      category: row.category,
      location: row.location,
      priority: row.priority,
      description: row.description,
    })),
  });

  const result = await generateContent({
    systemInstruction: prompt.systemInstruction,
    parts: [{ text: prompt.userText }],
    maxOutputTokens: 4096,
  });

  const rawClusters = Array.isArray(result.json?.clusters)
    ? result.json.clusters
    : [];

  const byId = new Map(
    candidates.map((row) => [Number(row.id), row])
  );
  const assignedIds = new Set();
  const allowedUrgency = ["Low", "Medium", "High"];
  const clusters = [];

  for (const item of rawClusters) {
    const rawIds = Array.isArray(item.complaintIds)
      ? item.complaintIds
      : [];

    const members = [];

    for (const rawId of rawIds) {
      const complaintId = Number(rawId);

      if (!Number.isInteger(complaintId) || assignedIds.has(complaintId)) {
        continue;
      }

      const existing = byId.get(complaintId);

      if (!existing) {
        continue;
      }

      assignedIds.add(complaintId);
      members.push(existing);
    }

    if (members.length < 2) {
      members.forEach((member) => assignedIds.delete(member.id));
      continue;
    }

    const clusterLabel = String(item.clusterLabel || "").trim();
    const summary = String(item.summary || "").trim();

    if (!clusterLabel || !summary) {
      members.forEach((member) => assignedIds.delete(member.id));
      continue;
    }

    const urgencyLevel = allowedUrgency.includes(item.urgencyLevel)
      ? item.urgencyLevel
      : members.some(
          (member) =>
            member.priority === "Urgent" || member.priority === "High"
        )
        ? "High"
        : "Medium";

    clusters.push({
      clusterLabel,
      category: String(item.category || members[0].category || "").trim(),
      complaintCount: members.length,
      commonLocation: String(
        item.commonLocation || members[0].location || ""
      ).trim(),
      urgencyLevel,
      complaintIds: members.map((member) => member.id),
      referenceNumbers: members.map(
        (member) => member.reference_number || `#${member.id}`
      ),
      summary,
    });

    if (clusters.length >= 6) {
      break;
    }
  }

  return {
    clusters,
    generatedAt: new Date().toISOString(),
  };
};

module.exports = {
  analyzeComplaintText,
  analyzeComplaintImage,
  findSimilarComplaints,
  answerAdminInsights,
  clusterComplaints,
  mapGeminiError,
  isGeminiConfigured,
};
