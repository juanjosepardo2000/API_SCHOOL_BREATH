const Course = require('../models/courses.model');
const CourseProgress = require('../models/userProgress.v2.model');
const { UserModel } = require("../models/user.model");
const axios = require('axios');
const {
  createInitialSectionsProgress,
  ensureSectionProgress,
  ensureLessonProgress,
  calculateCourseCompletion,
  recomputeAndAssignProgress,
  hasProgressDrift,
} = require('./course_progress_v2.helpers');

const fullAccessTags = ["Enrolled_Holistic Membership"];

exports.getCourseProgress = async (req, res) => {
  const { courseId } = req.params;
  const userId = req.user._id;

  const course = await Course.findById(courseId);
  if (!course) {
    return res.status(404).json({
      status: "error",
      message: "Course not found"
    });
  }

  let progress = await CourseProgress.findOne({ courseId, userId });
  if (!progress) {
    progress = await CourseProgress.create({
      userId,
      courseId,
      startDate: new Date(),
      lastAccessDate: new Date(),
      completionPercentage: 0,
      isCompleted: false,
      sectionsProgress: createInitialSectionsProgress(course),
    });
  } else {
    recomputeAndAssignProgress(progress, course);
    await progress.save();
  }

  res.status(200).json({
    status: "success",
    data: { progress },
  });
};

exports.markLessonAsCompleted = async (req, res) => {
  const { courseId, sectionId, lessonId } = req.params;
  const userId = req.user._id;

  const course = await Course.findById(courseId);
  if (!course) {
    return res.status(404).json({
      status: "error",
      message: "Course not found"
    });
  }

  const courseSection = course.sections.find((s) => s._id.toString() === sectionId);
  if (!courseSection) {
    return res.status(404).json({
      status: "error",
      message: "Section not found"
    });
  }

  const courseLesson = courseSection.lessons.find((l) => l._id.toString() === lessonId);
  if (!courseLesson) {
    return res.status(404).json({
      status: "error",
      message: "Lesson not found"
    });
  }

  let progress = await CourseProgress.findOne({ courseId, userId });
  if (!progress) {
    progress = await CourseProgress.create({
      userId,
      courseId,
      startDate: new Date(),
      lastAccessDate: new Date(),
      completionPercentage: 0,
      isCompleted: false,
      sectionsProgress: createInitialSectionsProgress(course),
    });
  }

  const sectionProgress = ensureSectionProgress(progress, courseSection);
  const lessonProgress = ensureLessonProgress(sectionProgress, courseLesson._id);

  lessonProgress.completed = true;
  lessonProgress.lastWatched = new Date();
  lessonProgress.status = 'completed';
  progress.lastAccessDate = new Date();

  recomputeAndAssignProgress(progress, course);
  await progress.save();

  res.status(200).json({
    status: "success",
    data: { progress },
  });
};

exports.updateLessonProgress = async (req, res) => {
  const { courseId, sectionId, lessonId } = req.params;
  const { watchTimeInSeconds } = req.body;
  const userId = req.user._id;

  if (typeof watchTimeInSeconds !== 'number' || watchTimeInSeconds < 0) {
    return res.status(400).json({
      status: "error",
      message: "Invalid watchTimeInSeconds"
    });
  }

  const course = await Course.findById(courseId);
  if (!course) {
    return res.status(404).json({
      status: "error",
      message: "Course not found"
    });
  }

  const courseSection = course.sections.find((s) => s._id.toString() === sectionId);
  if (!courseSection) {
    return res.status(404).json({
      status: "error",
      message: "Section not found"
    });
  }

  const courseLesson = courseSection.lessons.find((l) => l._id.toString() === lessonId);
  if (!courseLesson) {
    return res.status(404).json({
      status: "error",
      message: "Lesson not found"
    });
  }

  let progress = await CourseProgress.findOne({ courseId, userId });
  if (!progress) {
    progress = await CourseProgress.create({
      userId,
      courseId,
      startDate: new Date(),
      lastAccessDate: new Date(),
      completionPercentage: 0,
      isCompleted: false,
      sectionsProgress: createInitialSectionsProgress(course),
    });
  }

  const sectionProgress = ensureSectionProgress(progress, courseSection);
  const lessonProgress = ensureLessonProgress(sectionProgress, courseLesson._id);

  lessonProgress.watchTimeInSeconds = watchTimeInSeconds;
  lessonProgress.lastWatched = new Date();
  lessonProgress.status = lessonProgress.completed
    ? 'completed'
    : watchTimeInSeconds > 0
      ? 'in-progress'
      : 'pending';
  progress.lastAccessDate = new Date();

  recomputeAndAssignProgress(progress, course);
  await progress.save();

  res.status(200).json({
    status: "success",
    data: { progress },
  });
};

exports.getCourseStatistics = async (req, res) => {
  try {
    const userEmail = req.user.email;
    const user = await UserModel.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const response = await axios.get(
      `https://api.systeme.io/api/contacts?email=${userEmail}`,
      {
        headers: {
          "x-api-key": process.env.API_SYSTEME_KEY,
        },
      }
    );

    const contacts = response.data?.items[0] ?? null;
    const userTags = contacts ? contacts.tags.map((tag) => tag.name) : [];
    const hasFullAccess = userTags.some((tag) => fullAccessTags.includes(tag));

    const courses = await Course.find().sort({ order: 1, createdAt: -1 });
    const accessibleCourses = courses.filter((course) =>
      hasFullAccess ||
      (Array.isArray(course.accessTags) && course.accessTags.some((tag) => userTags.includes(tag)))
    );

    const progresses = await CourseProgress.find({ userId: user._id });
    const progressMap = progresses.reduce((acc, progress) => {
      acc[String(progress.courseId)] = progress;
      return acc;
    }, {});

    let completedCourses = 0;
    let inProgressCourses = 0;
    const progressDriftFixes = [];

    const courseProgress = accessibleCourses.map((course) => {
      const progressData = progressMap[String(course._id)];
      if (progressData) {
        const computedProgress = calculateCourseCompletion(course, progressData);

        if (computedProgress.isCompleted) {
          completedCourses += 1;
        } else if (computedProgress.completionPercentage > 0) {
          inProgressCourses += 1;
        }

        if (hasProgressDrift(progressData, computedProgress)) {
          progressDriftFixes.push({
            updateOne: {
              filter: { _id: progressData._id },
              update: {
                $set: {
                  completionPercentage: computedProgress.completionPercentage,
                  isCompleted: computedProgress.isCompleted,
                },
              },
            },
          });
        }

        return {
          courseId: String(course._id),
          title: course.title,
          completionPercentage: computedProgress.completionPercentage,
          isCompleted: computedProgress.isCompleted,
          lastAccessDate: progressData.lastAccessDate,
          completedSections: computedProgress.completedSections,
          totalSections: computedProgress.totalSections,
          completedLessons: computedProgress.completedLessons,
          totalLessons: computedProgress.totalLessons,
        };
      }

      return {
        courseId: String(course._id),
        title: course.title,
        completionPercentage: 0,
        isCompleted: false,
        lastAccessDate: null,
        completedSections: 0,
        totalSections: course.sections.length,
        completedLessons: 0,
        totalLessons: course.sections.reduce((acc, section) => acc + section.lessons.length, 0),
      };
    });

    if (progressDriftFixes.length > 0) {
      await CourseProgress.bulkWrite(progressDriftFixes);
    }

    const totalCourses = accessibleCourses.length;
    const completedPercentage = totalCourses > 0 ? (completedCourses / totalCourses) * 100 : 0;

    return res.status(200).json({
      totalCourses,
      completedCourses,
      inProgressCourses,
      completedPercentage,
      courseProgress,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateLessonDuration = async (req, res) => {
  try {
    const { courseId, sectionId, lessonId } = req.params;
    const { durationInSeconds } = req.body;

    if (typeof durationInSeconds !== 'number' || durationInSeconds < 0) {
      return res.status(400).json({
        status: "error",
        message: "Invalid duration value"
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        status: "error",
        message: "Course not found"
      });
    }

    const section = course.sections.find(s => s._id.toString() === sectionId);
    if (!section) {
      return res.status(404).json({
        status: "error",
        message: "Section not found"
      });
    }

    const lesson = section.lessons.find(l => l._id.toString() === lessonId);
    if (!lesson) {
      return res.status(404).json({
        status: "error",
        message: "Lesson not found"
      });
    }

    if (lesson.durationInSeconds === 0 || lesson.durationInSeconds === undefined) {
      lesson.durationInSeconds = Math.floor(durationInSeconds);
      await course.save();

      return res.status(200).json({
        status: "success",
        message: "Duration updated successfully",
        data: { durationInSeconds: lesson.durationInSeconds }
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Duration already set",
      data: { durationInSeconds: lesson.durationInSeconds }
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
};
