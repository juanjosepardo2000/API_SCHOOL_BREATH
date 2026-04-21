const Course = require('../models/courses.model');
const CourseProgress = require('../models/userProgress.model');
const { UserModel } = require("../models/user.model");
const axios = require('axios');

// Access control configuration
const fullAccessTags = ["Enrolled_Holistic Membership"];

/**
 * Get Resume Learning
 * Returns the most relevant lesson for the user to continue their learning journey
 *
 * Priority Logic:
 * 1. Resume the last lesson the user was watching (most recent lastWatched)
 * 2. If that lesson is completed, return the next incomplete lesson in the same course
 * 3. If the course is completed, return the first lesson of the next available course
 * 4. If all courses are completed, return null
 *
 * @route GET /learning/resume
 * @access Private (requires authorization)
 */
exports.getResumeLearning = async (req, res) => {
  try {
    const userId = req.user._id;
    const userEmail = req.user.email;

    // Get all user progress records sorted by lastAccessDate
    const allProgress = await CourseProgress.find({ userId })
      .sort({ lastAccessDate: -1 })
      .lean();

    if (!allProgress || allProgress.length === 0) {
      return res.status(200).json({
        status: "success",
        data: null
      });
    }

    // Get user tags for access control
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
    const hasFullAccess = userTags.some(tag => fullAccessTags.includes(tag));

    const allCourses = await Course.find().sort({ order: 1, createdAt: 1 });
    const accessibleCourses = allCourses.filter((course) => {
      const hasSpecificAccess = course.accessTags.some(tag => userTags.includes(tag));
      return hasFullAccess || hasSpecificAccess;
    });

    const accessibleCourseMap = new Map(
      accessibleCourses.map(course => [course._id.toString(), course])
    );

    const progressMap = new Map(
      allProgress
        .filter(progress => accessibleCourseMap.has(progress.courseId.toString()))
        .map(progress => [progress.courseId.toString(), progress])
    );

    const buildResumeData = (course, section, lesson, lessonProgress, progress) => ({
      courseId: course._id.toString(),
      courseTitle: course.title,
      sectionId: section._id.toString(),
      lessonId: lesson._id.toString(),
      lessonTitle: lesson.title,
      videoUrl: lesson.videoUrl || "",
      fromYoutube: lesson.isFromYoutube || false,
      completed: lessonProgress?.completed || false,
      watchTimeInSeconds: lessonProgress?.watchTimeInSeconds || 0,
      duration: lesson.durationInSeconds || 0,
      lastWatched: lessonProgress?.lastWatched || null,
      progress: progress?.completionPercentage || 0
    });

    const getLessonProgress = (progress, sectionId, lessonId) => {
      if (!progress) return null;
      const sectionProgress = progress.sectionsProgress.find(
        sp => sp.sectionId.toString() === sectionId.toString()
      );
      return sectionProgress?.lessonsProgress.find(
        lp => lp.lessonId.toString() === lessonId.toString()
      ) || null;
    };

    const findFirstIncompleteLesson = (course, progress) => {
      for (const section of course.sections || []) {
        for (const lesson of section.lessons || []) {
          const lessonProgress = getLessonProgress(progress, section._id, lesson._id);
          if (!lessonProgress || !lessonProgress.completed) {
            return { section, lesson, lessonProgress };
          }
        }
      }
      return null;
    };

    const findNextIncompleteLesson = (course, progress, currentSectionId, currentLessonId) => {
      let foundCurrent = false;
      for (const section of course.sections || []) {
        for (const lesson of section.lessons || []) {
          if (section._id.toString() === currentSectionId.toString() &&
              lesson._id.toString() === currentLessonId.toString()) {
            foundCurrent = true;
            continue;
          }
          if (!foundCurrent) continue;
          const lessonProgress = getLessonProgress(progress, section._id, lesson._id);
          if (!lessonProgress || !lessonProgress.completed) {
            return { section, lesson, lessonProgress };
          }
        }
      }
      return null;
    };

    const findNextCourseLesson = (currentCourseId) => {
      const currentIndex = accessibleCourses.findIndex(
        course => course._id.toString() === currentCourseId.toString()
      );

      for (let i = currentIndex + 1; i < accessibleCourses.length; i += 1) {
        const nextCourse = accessibleCourses[i];
        const nextProgress = progressMap.get(nextCourse._id.toString());
        const nextLessonData = findFirstIncompleteLesson(nextCourse, nextProgress);
        if (nextLessonData) {
          return { course: nextCourse, progress: nextProgress, ...nextLessonData };
        }
      }
      return null;
    };

    // Priority 1: most recently watched lesson (by lastWatched)
    let mostRecent = null;
    for (const progress of allProgress) {
      const course = accessibleCourseMap.get(progress.courseId.toString());
      if (!course) continue;

      for (const sectionProgress of progress.sectionsProgress || []) {
        const courseSection = course.sections.find(
          s => s._id.toString() === sectionProgress.sectionId.toString()
        );
        if (!courseSection) continue;

        for (const lessonProgress of sectionProgress.lessonsProgress || []) {
          if (!lessonProgress.lastWatched) continue;
          const courseLesson = courseSection.lessons.find(
            l => l._id.toString() === lessonProgress.lessonId.toString()
          );
          if (!courseLesson) continue;

          if (!mostRecent || new Date(lessonProgress.lastWatched) > new Date(mostRecent.lastWatched)) {
            mostRecent = {
              course,
              progress,
              section: courseSection,
              lesson: courseLesson,
              lessonProgress,
              lastWatched: lessonProgress.lastWatched
            };
          }
        }
      }
    }

    if (mostRecent) {
      if (!mostRecent.lessonProgress.completed) {
        return res.status(200).json({
          status: "success",
          data: buildResumeData(
            mostRecent.course,
            mostRecent.section,
            mostRecent.lesson,
            mostRecent.lessonProgress,
            mostRecent.progress
          )
        });
      }

      const nextLesson = findNextIncompleteLesson(
        mostRecent.course,
        mostRecent.progress,
        mostRecent.section._id,
        mostRecent.lesson._id
      );

      if (nextLesson) {
        return res.status(200).json({
          status: "success",
          data: buildResumeData(
            mostRecent.course,
            nextLesson.section,
            nextLesson.lesson,
            nextLesson.lessonProgress,
            mostRecent.progress
          )
        });
      }

      const nextCourseLesson = findNextCourseLesson(mostRecent.course._id);
      if (nextCourseLesson) {
        return res.status(200).json({
          status: "success",
          data: buildResumeData(
            nextCourseLesson.course,
            nextCourseLesson.section,
            nextCourseLesson.lesson,
            nextCourseLesson.lessonProgress,
            nextCourseLesson.progress
          )
        });
      }
    }

    // Priority 2: no lastWatched data, fall back to first incomplete lesson in the first available course
    for (const course of accessibleCourses) {
      const progress = progressMap.get(course._id.toString());
      const nextLessonData = findFirstIncompleteLesson(course, progress);
      if (nextLessonData) {
        return res.status(200).json({
          status: "success",
          data: buildResumeData(course, nextLessonData.section, nextLessonData.lesson, nextLessonData.lessonProgress, progress)
        });
      }
    }

    // No courses available at all
    return res.status(200).json({
      status: "success",
      data: null
    });

  } catch (error) {
    console.error('getResumeLearning error:', error);
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
};

/**
 * Get Course Sections with Full Progress Data
 * Returns all sections and lessons for a course with complete progress information
 * including watchTimeInSeconds, duration, and completed status
 *
 * @route GET /learning/course/:courseId/sections
 * @access Public (but filtered based on user access)
 * @query {string} email - User email for access control and progress tracking
 */
exports.getCourseSectionsWithProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userEmail = req.query.email;

    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        status: "error",
        message: "Course not found"
      });
    }

    // If no email provided, return limited access (non-premium content only)
    if (!userEmail) {
      const sectionsWithLimitedAccess = course.sections
        .map((section) => {
          const sectionData = section.toObject();

          // Filter premium lessons if section is premium
          if (section.isPremium) {
            sectionData.lessons = section.lessons.filter(
              (lesson) => !lesson.isPremium
            );
          }

          // Add progress fields (all false/0 for unauthenticated users)
          sectionData.lessons = sectionData.lessons.map(lesson => ({
            ...lesson,
            completed: false,
            watchTimeInSeconds: 0,
            duration: lesson.durationInSeconds || 0
          }));

          sectionData.isCompleted = false;
          return sectionData;
        })
        .filter((section) => section.lessons.length > 0);

      return res.status(200).json({
        status: "success",
        data: {
          sections: sectionsWithLimitedAccess,
          hasAccess: false
        }
      });
    }

    // Get user tags from Systeme.io for access control
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

    // Check access levels
    const hasFullAccess = userTags.some((tag) => fullAccessTags.includes(tag));
    const hasSpecificAccess = course.accessTags.some((tag) => userTags.includes(tag));

    // Get user progress data
    const user = await UserModel.findOne({ email: userEmail });
    const progressData = user ?
      await CourseProgress.findOne({ userId: user._id, courseId: course._id }) : null;

    // Build sections with full progress information
    const sectionsWithProgress = course.sections.map((section) => {
      const sectionData = section.toObject();
      let allLessonsCompleted = true;

      // Enhance each lesson with progress data
      sectionData.lessons = sectionData.lessons.map((lesson) => {
        let lessonWithProgress = {
          ...lesson,
          completed: false,
          watchTimeInSeconds: 0,
          duration: lesson.durationInSeconds || 0
        };

        // If we have progress data, merge it
        if (progressData) {
          const sectionProgress = progressData.sectionsProgress.find(
            sp => sp.sectionId.toString() === section._id.toString()
          );

          if (sectionProgress) {
            const lessonProgress = sectionProgress.lessonsProgress.find(
              lp => lp.lessonId.toString() === lesson._id.toString()
            );

            if (lessonProgress) {
              lessonWithProgress.completed = lessonProgress.completed || false;
              lessonWithProgress.watchTimeInSeconds = lessonProgress.watchTimeInSeconds || 0;
              lessonWithProgress.lastWatched = lessonProgress.lastWatched || null;
            }
          }
        }

        // Track if all lessons are completed for section completion status
        if (!lessonWithProgress.completed) {
          allLessonsCompleted = false;
        }

        return lessonWithProgress;
      });

      sectionData.isCompleted = allLessonsCompleted;
      return sectionData;
    });

    // Filter premium content if user doesn't have access
    if (!hasFullAccess && !hasSpecificAccess) {
      const filteredSections = sectionsWithProgress
        .map((section) => {
          // If section is premium, filter out premium lessons
          if (section.isPremium) {
            section.lessons = section.lessons.filter(
              (lesson) => !lesson.isPremium
            );
          }
          return section;
        })
        .filter((section) => section.lessons.length > 0);

      return res.status(200).json({
        status: "success",
        data: {
          sections: filteredSections,
          hasAccess: false
        }
      });
    }

    // User has full access - return all content with progress
    return res.status(200).json({
      status: "success",
      data: {
        sections: sectionsWithProgress,
        hasAccess: true
      }
    });

  } catch (error) {
    console.error('getCourseSectionsWithProgress error:', error);
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
};
