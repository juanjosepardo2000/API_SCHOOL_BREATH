const createInitialSectionsProgress = (course) => {
  return (course.sections || []).map((section) => ({
    sectionId: section._id.toString(),
    lessonsProgress: (section.lessons || []).map((lesson) => ({
      lessonId: lesson._id.toString(),
      completed: false,
      watchTimeInSeconds: 0,
      lastWatched: null,
      status: 'pending',
    })),
  }));
};

const ensureSectionProgress = (progressDoc, courseSection) => {
  const sectionId = courseSection._id.toString();
  let sectionProgress = (progressDoc.sectionsProgress || []).find(
    (s) => s.sectionId.toString() === sectionId
  );

  if (!sectionProgress) {
    sectionProgress = {
      sectionId,
      lessonsProgress: (courseSection.lessons || []).map((lesson) => ({
        lessonId: lesson._id.toString(),
        completed: false,
        watchTimeInSeconds: 0,
        lastWatched: null,
        status: 'pending',
      })),
    };
    progressDoc.sectionsProgress.push(sectionProgress);
  }

  return sectionProgress;
};

const ensureLessonProgress = (sectionProgress, lessonId) => {
  const normalizedLessonId = lessonId.toString();
  let lessonProgress = (sectionProgress.lessonsProgress || []).find(
    (l) => l.lessonId.toString() === normalizedLessonId
  );

  if (!lessonProgress) {
    lessonProgress = {
      lessonId: normalizedLessonId,
      completed: false,
      watchTimeInSeconds: 0,
      lastWatched: null,
      status: 'pending',
    };
    sectionProgress.lessonsProgress.push(lessonProgress);
  }

  return lessonProgress;
};

const calculateCourseCompletion = (course, progressData) => {
  let totalLessons = 0;
  let completedLessons = 0;
  let completedSections = 0;

  const sections = Array.isArray(course?.sections) ? course.sections : [];
  const sectionsProgress = Array.isArray(progressData?.sectionsProgress)
    ? progressData.sectionsProgress
    : [];

  sections.forEach((section) => {
    const sectionLessons = Array.isArray(section?.lessons) ? section.lessons : [];
    totalLessons += sectionLessons.length;

    if (sectionLessons.length === 0) {
      completedSections += 1;
      return;
    }

    const sectionProgress = sectionsProgress.find(
      (sp) => sp.sectionId?.toString() === section._id?.toString()
    );

    let completedLessonsInSection = 0;
    sectionLessons.forEach((lesson) => {
      const lessonProgress = sectionProgress?.lessonsProgress?.find(
        (lp) => lp.lessonId?.toString() === lesson._id?.toString()
      );

      if (lessonProgress?.completed) {
        completedLessons += 1;
        completedLessonsInSection += 1;
      }
    });

    if (completedLessonsInSection === sectionLessons.length) {
      completedSections += 1;
    }
  });

  const completionPercentage =
    totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

  return {
    totalLessons,
    completedLessons,
    totalSections: sections.length,
    completedSections,
    completionPercentage,
    isCompleted: totalLessons > 0 && completedLessons === totalLessons,
  };
};

const recomputeAndAssignProgress = (progressDoc, course) => {
  const computed = calculateCourseCompletion(course, progressDoc);
  progressDoc.completionPercentage = computed.completionPercentage;
  progressDoc.isCompleted = computed.isCompleted;
  return computed;
};

const hasProgressDrift = (progressDoc, computed) => {
  if (!progressDoc || !computed) return false;
  const storedPercentage = Number(progressDoc.completionPercentage || 0);
  const computedPercentage = Number(computed.completionPercentage || 0);
  return (
    Math.abs(storedPercentage - computedPercentage) > 0.01 ||
    Boolean(progressDoc.isCompleted) !== Boolean(computed.isCompleted)
  );
};

module.exports = {
  createInitialSectionsProgress,
  ensureSectionProgress,
  ensureLessonProgress,
  calculateCourseCompletion,
  recomputeAndAssignProgress,
  hasProgressDrift,
};

