const Course = require('../models/courses.model');
const CourseProgress = require('../models/userProgress.v2.model');
const axios = require('axios');
const { calculateCourseCompletion } = require('./course_progress_v2.helpers');

const fullAccessTags = ["Enrolled_Holistic Membership"];

exports.getResumeLearning = async (req, res) => {
  try {
    const userId = req.user._id;
    const userEmail = req.user.email;

    const allProgress = await CourseProgress.find({ userId })
      .sort({ lastAccessDate: -1 })
      .lean();

    if (!allProgress || allProgress.length === 0) {
      return res.status(200).json({
        status: "success",
        data: null
      });
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

    const allCourses = await Course.find().sort({ order: 1, createdAt: 1 });
    const accessibleCourses = allCourses.filter((course) => {
      const hasSpecificAccess =
        Array.isArray(course.accessTags) && course.accessTags.some((tag) => userTags.includes(tag));
      return hasFullAccess || hasSpecificAccess;
    });

    const accessibleCourseMap = new Map(
      accessibleCourses.map((course) => [course._id.toString(), course])
    );

    const progressMap = new Map(
      allProgress
        .filter((progress) => accessibleCourseMap.has(progress.courseId.toString()))
        .map((progress) => [progress.courseId.toString(), progress])
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
      progress: calculateCourseCompletion(course, progress).completionPercentage || 0
    });

    const getLessonProgress = (progress, sectionId, lessonId) => {
      if (!progress) return null;
      const sectionProgress = progress.sectionsProgress.find(
        (sp) => sp.sectionId.toString() === sectionId.toString()
      );
      return sectionProgress?.lessonsProgress.find(
        (lp) => lp.lessonId.toString() === lessonId.toString()
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
          if (
            section._id.toString() === currentSectionId.toString() &&
            lesson._id.toString() === currentLessonId.toString()
          ) {
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
        (course) => course._id.toString() === currentCourseId.toString()
      );

      for (let index = currentIndex + 1; index < accessibleCourses.length; index += 1) {
        const nextCourse = accessibleCourses[index];
        const nextProgress = progressMap.get(nextCourse._id.toString());
        const nextLessonData = findFirstIncompleteLesson(nextCourse, nextProgress);
        if (nextLessonData) {
          return { course: nextCourse, progress: nextProgress, ...nextLessonData };
        }
      }
      return null;
    };

    let mostRecent = null;
    for (const progress of allProgress) {
      const course = accessibleCourseMap.get(progress.courseId.toString());
      if (!course) continue;

      for (const sectionProgress of progress.sectionsProgress || []) {
        const courseSection = course.sections.find(
          (section) => section._id.toString() === sectionProgress.sectionId.toString()
        );
        if (!courseSection) continue;

        for (const lessonProgress of sectionProgress.lessonsProgress || []) {
          if (!lessonProgress.lastWatched) continue;
          const courseLesson = courseSection.lessons.find(
            (lesson) => lesson._id.toString() === lessonProgress.lessonId.toString()
          );
          if (!courseLesson) continue;

          if (!mostRecent || new Date(lessonProgress.lastWatched) > new Date(mostRecent.lastWatched)) {
            mostRecent = {
              course,
              progress,
              section: courseSection,
              lesson: courseLesson,
              lessonProgress,
              lastWatched: lessonProgress.lastWatched,
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
          ),
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
          ),
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
          ),
        });
      }
    }

    for (const course of accessibleCourses) {
      const progress = progressMap.get(course._id.toString());
      const nextLessonData = findFirstIncompleteLesson(course, progress);
      if (nextLessonData) {
        return res.status(200).json({
          status: "success",
          data: buildResumeData(
            course,
            nextLessonData.section,
            nextLessonData.lesson,
            nextLessonData.lessonProgress,
            progress
          ),
        });
      }
    }

    return res.status(200).json({
      status: "success",
      data: null
    });

  } catch (error) {
    console.error('getResumeLearning v2 error:', error);
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
};
