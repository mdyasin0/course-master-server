const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// ----------------------
// MongoDB Connect
// ----------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("DB Error:", err));

// ----------------------
// COURSE SCHEMA
// ----------------------
const courseSchema = new mongoose.Schema({
  title: String,
  description: String,
  instructor: String,
  price: Number,
  category: String,
  syllabus: String,
  batch: String,
  thumbnail: String,
  lessons: [String], // video links
  assignments: [
    {
      title: { type: String, required: true },
      description: { type: String, required: true },
      link: String,
    },
  ],
});

const Course = mongoose.model("Course", courseSchema);

// ----------------------
// USER SCHEMA
// ----------------------
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "student" },
  registeredAt: { type: Date, default: Date.now },
});

const Users = mongoose.model("Users", userSchema);

// ----------------------
// REGISTER ROUTE
// ----------------------
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await Users.findOne({ email });
    if (existingUser)
      return res
        .status(400)
        .json({ success: false, message: "Email already exists!" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new Users({
      name,
      email,
      password: hashedPassword,
      role: "student",
    });

    await newUser.save();

    res
      .status(201)
      .json({ success: true, message: "User registered successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------
// COURSE CRUD
// ----------------------
app.post("/create-course", async (req, res) => {
  try {
    const newCourse = new Course(req.body);
    await newCourse.save();
    res.status(201).json({
      success: true,
      message: "Course created successfully!",
      course: newCourse,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/courses", async (req, res) => {
  try {
    const courses = await Course.find();
    res.status(200).json({ success: true, total: courses.length, courses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/course/:id", async (req, res) => {
  try {
    const updatedCourse = await Course.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!updatedCourse)
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    res.status(200).json({ success: true, course: updatedCourse });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/course/:id", async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course)
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    res.status(200).json({ success: true, course });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/course/:id", async (req, res) => {
  try {
    const deletedCourse = await Course.findByIdAndDelete(req.params.id);
    if (!deletedCourse)
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    res.status(200).json({
      success: true,
      message: "Course deleted",
      course: deletedCourse,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ----------------------
// ENROLLMENT SCHEMA
// ----------------------
const enrollmentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  courseTitle: String,
  name: String,
  email: String,
  phone: String,
  amount: Number,
  paymentMethod: String,
  transactionId: String,
  status: { type: String, default: "pending" }, // main status: pending/approved/blocked
  courseStatus: { type: String, default: "pending" }, // new field: course progress
  assignmentStatus: { type: String, default: "pending" }, // new field: assignment progress
  createdAt: { type: Date, default: Date.now },
});

const Enrollment = mongoose.model("Enrollment", enrollmentSchema);

// ----------------------
// MANUAL ENROLLMENT ROUTE
// ----------------------
app.post("/enroll/manual", async (req, res) => {
  try {
    const {
      userId,
      courseId,
      courseTitle,
      name,
      email,
      phone,
      amount,
      paymentMethod,
      transactionId,
    } = req.body;

    // --- CHECK: same user + same course already enrolled? ---
    const existing = await Enrollment.findOne({ email, courseId });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "You have already enrolled in this course!",
      });
    }

    // --- If not exists, then create enrollment ---
    const enrollment = new Enrollment({
      userId,
      courseId,
      courseTitle,
      name,
      email,
      phone,
      amount,
      paymentMethod,
      transactionId,
      status: "pending", // main status
      courseStatus: "pending", // new field
      assignmentStatus: "pending", // new field
    });

    await enrollment.save();

    res.status(201).json({
      success: true,
      message: "Enrollment submitted! Waiting for admin approval.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// --------------------
// check enrollment before enroll for not repeate
// -----------

app.get("/check-enrollment", async (req, res) => {
  const { email, courseId } = req.query;

  const exists = await Enrollment.findOne({ email, courseId });

  res.json({ exists: !!exists });
});

// -------------------
// get all enrolment data
// ---------

app.get("/enrollments", async (req, res) => {
  try {
    const enrollments = await Enrollment.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, enrollments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// --------------
// status process
// ----------------
app.put("/enrollment/approve/:id", async (req, res) => {
  try {
    const { adminTransactionId } = req.body;

    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment)
      return res.status(404).json({ message: "Enrollment not found" });

    if (enrollment.transactionId !== adminTransactionId)
      return res.status(400).json({ message: "Transaction ID mismatch" });

    enrollment.status = "approved";
    await enrollment.save();

    res.json({ message: "Enrollment approved successfully!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// -------
// block sttatus
// ---------------------------------
app.put("/enrollment/block/:id", async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment)
      return res.status(404).json({ message: "Enrollment not found" });

    enrollment.status = "blocked";
    await enrollment.save();

    res.json({ message: "Enrollment has been blocked!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// ----------------------
// Unblock Enrollment (blocked → pending)
// ----------------------
app.put("/enrollment/unblock/:id", async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment)
      return res.status(404).json({ message: "Enrollment not found" });

    // Status unblock → pending
    enrollment.status = "pending";
    await enrollment.save();

    res.json({ message: "Enrollment has been unblocked and set to pending!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get enrollments for a specific user
app.get("/enrollments/user/:email", async (req, res) => {
  try {
    const { email } = req.params;

    // Find all enrollments of this user
    const enrollments = await Enrollment.find({ email });

    // Count status
    const total = enrollments.length;
    const pending = enrollments.filter((e) => e.status === "pending").length;
    const approved = enrollments.filter((e) => e.status === "approved").length;
    const blocked = enrollments.filter((e) => e.status === "blocked").length;

    res.status(200).json({
      success: true,
      total,
      pending,
      approved,
      blocked,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Route: Get courses a user has enrolled in
app.get("/user/enrolled-courses/:email", async (req, res) => {
  try {
    const { email } = req.params;

    // 1. User's enrollments fetch
    const enrollments = await Enrollment.find({ email });

    // 2. Extract courseIds
    const courseIds = enrollments.map((e) => e.courseId);

    // 3. Fetch courses matching these courseIds
    const courses = await Course.find({ _id: { $in: courseIds } });

    res.status(200).json({ success: true, total: courses.length, courses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get user's ONLY approved enrollments + matching course data
app.get("/user/enrollments-with-courses/:email", async (req, res) => {
  try {
    const { email } = req.params;

    // 1) Get user's ONLY APPROVED enrollments
    const enrollments = await Enrollment.find({
      email,
      status: "approved", //  Only bring approved enrollments
    }).sort({ createdAt: -1 });

    // 2) Get distinct courseIds from enrollments
    const courseIds = enrollments.map((e) => e.courseId);

    // 3) Fetch courses that match those ids
    const courses = await Course.find({ _id: { $in: courseIds } });

    // 4) Map courses by id for quick lookup
    const courseMap = {};
    courses.forEach((c) => {
      courseMap[c._id.toString()] = c;
    });

    // 5) Combine data
    const combined = enrollments.map((e) => ({
      enrollment: e,
      course: courseMap[e.courseId.toString()] || null,
    }));

    res.status(200).json({ success: true, total: combined.length, combined });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Complete Course
app.put("/course/complete/:enrollId", async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.enrollId);
    if (!enrollment)
      return res.status(404).json({ message: "Enrollment not found" });

    enrollment.courseStatus = "complete";
    await enrollment.save();

    res.json({ success: true, message: "Course Completed!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// ----------------------
// SUBMIT ASSIGNMENT SCHEMA
// ----------------------
const submitAssignmentSchema = new mongoose.Schema({
  assignmentTitle: { type: String, required: true },
  assignmentDetails: { type: String, required: true },
  assignmentLink: String, // teacher-provided link (optional)
  studentSubmitLink: String, // student-submitted link
  status: { type: String, default: "pending" }, // pending/submitted
  enrollmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Enrollment" },
  createdAt: { type: Date, default: Date.now },
});

const SubmitAssignment = mongoose.model(
  "SubmitAssignment",
  submitAssignmentSchema
);
// Submit assignment
app.post("/assignment/submit", async (req, res) => {
  try {
    const {
      assignmentTitle,
      assignmentDetails,
      assignmentLink,
      studentSubmitLink,
      enrollmentId,
    } = req.body;

    const newSubmit = new SubmitAssignment({
      assignmentTitle,
      assignmentDetails,
      assignmentLink,
      studentSubmitLink,
      enrollmentId,
      status: "pending",
    });

    await newSubmit.save();

    res.status(201).json({ success: true, message: "Assignment submitted!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});
// ----------------------
// GET all submitted assignments
// ----------------------
app.get("/assignment/submissions", async (req, res) => {
  try {
    const submissions = await SubmitAssignment.find().sort({ createdAt: -1 });
    res
      .status(200)
      .json({ success: true, total: submissions.length, submissions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------
// Mark assignment as complete and update enrollment
// ----------------------
app.put("/assignment/complete/:id", async (req, res) => {
  try {
    const submission = await SubmitAssignment.findById(req.params.id);
    if (!submission)
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });

    // Update submission status
    submission.status = "complete";
    await submission.save();

    // Update enrollment's assignmentStatus
    const enrollmentId = submission.enrollmentId;
    await Enrollment.findByIdAndUpdate(enrollmentId, {
      assignmentStatus: "complete",
    });

    res.json({
      success: true,
      message: "Assignment and enrollment marked as complete!",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------
// SERVER START
// ----------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
