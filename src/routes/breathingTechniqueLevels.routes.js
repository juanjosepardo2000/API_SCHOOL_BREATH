const { Router } = require('express');
const passport = require('passport');
const {
  getTechniqueLevels,
  saveTechniqueLevels,
} = require('../controllers/breathingTechniqueLevels.controller');

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

router.get('/technique-levels',  auth, getTechniqueLevels);
router.patch('/technique-levels', auth, saveTechniqueLevels);

module.exports = router;
