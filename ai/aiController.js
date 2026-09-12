const {
  analyzeComplaintText,
  analyzeComplaintImage,
  findSimilarComplaints,
  answerAdminInsights,
  clusterComplaints,
  mapGeminiError,
} = require("./geminiService");

const sendAiError = (res, error) => {
  console.error("CampusFix AI error:", error.code || error.message);

  const mapped = mapGeminiError(error);

  const knownMessages = [
    "CampusFix AI could not produce a valid recommendation. You can continue submitting the complaint manually.",
    "CampusFix AI could not assess this image. You can continue submitting the complaint manually.",
    "CampusFix AI could not generate insights right now.",
  ];

  const message = knownMessages.includes(error.message)
    ? error.message
    : mapped.message;

  return res.status(mapped.status).json({
    success: false,
    message,
  });
};

const analyzeText = async (req, res) => {
  try {
    const text = String(
      req.body.text || req.body.description || ""
    ).trim();
    const title = String(req.body.title || "").trim();
    const location = String(req.body.location || "").trim();

    if (text.length < 12) {
      return res.status(400).json({
        success: false,
        message:
          "Write a short description of the issue before analyzing with AI.",
      });
    }

    if (text.length > 4000) {
      return res.status(400).json({
        success: false,
        message: "Description is too long to analyze.",
      });
    }

    const analysis = await analyzeComplaintText({
      text,
      title,
      location,
    });

    return res.status(200).json({
      success: true,
      analysis,
      disclaimer:
        "AI recommendation — review and confirm before submitting.",
    });
  } catch (error) {
    return sendAiError(res, error);
  }
};

const analyzeImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please attach an evidence image to analyze.",
      });
    }

    const analysis = await analyzeComplaintImage({
      imageBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
      text: String(req.body.text || req.body.description || "").trim(),
      title: String(req.body.title || "").trim(),
      location: String(req.body.location || "").trim(),
    });

    return res.status(200).json({
      success: true,
      analysis,
      disclaimer: "AI assessment — verify before submitting.",
    });
  } catch (error) {
    return sendAiError(res, error);
  }
};

const similarComplaints = async (req, res) => {
  try {
    const description = String(
      req.body.description || req.body.text || ""
    ).trim();
    const title = String(req.body.title || "").trim();
    const location = String(req.body.location || "").trim();
    const category = String(req.body.category || "").trim();

    if (description.length < 8 && title.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          "Add a title or description before checking for similar complaints.",
      });
    }

    const matches = await findSimilarComplaints({
      title,
      description: description || title,
      location,
      category,
    });

    return res.status(200).json({
      success: true,
      matches,
    });
  } catch (error) {
    return sendAiError(res, error);
  }
};

const insights = async (req, res) => {
  try {
    const question = String(req.body.question || "").trim();

    if (question.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Enter a question about campus complaint data.",
      });
    }

    if (question.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Question is too long.",
      });
    }

    const result = await answerAdminInsights(question);

    return res.status(200).json({
      success: true,
      answer: result.answer,
      usedDataSummary: result.usedDataSummary,
      generatedAt: result.generatedAt,
    });
  } catch (error) {
    return sendAiError(res, error);
  }
};

const clusterIssues = async (req, res) => {
  try {
    const result = await clusterComplaints();

    return res.status(200).json({
      success: true,
      clusters: result.clusters,
      generatedAt: result.generatedAt,
    });
  } catch (error) {
    return sendAiError(res, error);
  }
};

module.exports = {
  analyzeText,
  analyzeImage,
  similarComplaints,
  insights,
  clusterIssues,
};
