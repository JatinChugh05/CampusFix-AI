const express = require("express");
const multer = require("multer");

const {
  analyzeText,
  analyzeImage,
  similarComplaints,
  insights,
  clusterIssues,
} = require("./aiController");

const {
  authenticate,
  authorize,
} = require("../middleware/authMiddleware");

const {
  aiLimiter,
} = require("../middleware/securityMiddleware");

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const uploadAiImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 5 * 1024 * 1024,
    fields: 10,
    fieldSize: 64 * 1024,
  },
  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        file.fieldname
      );
      error.message =
        "Only JPG, JPEG, PNG or WEBP evidence images are allowed.";
      return callback(error);
    }

    return callback(null, true);
  },
});

const handleAiImageUpload = (req, res, next) => {
  uploadAiImage.fields([
    { name: "image", maxCount: 1 },
    { name: "evidence", maxCount: 1 },
  ])(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            message: "Evidence image must be smaller than 5 MB.",
          });
        }

        return res.status(400).json({
          success: false,
          message:
            error.message ||
            "Unable to process the uploaded evidence image.",
        });
      }

      return res.status(400).json({
        success: false,
        message: "Invalid evidence image.",
      });
    }

    const file =
      req.files?.image?.[0] || req.files?.evidence?.[0] || null;

    req.file = file;
    return next();
  });
};

const router = express.Router();

router.post(
  "/analyze-text",
  authenticate,
  authorize("student"),
  aiLimiter,
  analyzeText
);

router.post(
  "/analyze-image",
  authenticate,
  authorize("student"),
  aiLimiter,
  handleAiImageUpload,
  analyzeImage
);

router.post(
  "/similar-complaints",
  authenticate,
  authorize("student"),
  aiLimiter,
  similarComplaints
);

router.post(
  "/insights",
  authenticate,
  authorize("admin"),
  aiLimiter,
  insights
);

router.post(
  "/cluster-issues",
  authenticate,
  authorize("admin"),
  aiLimiter,
  clusterIssues
);

module.exports = router;
