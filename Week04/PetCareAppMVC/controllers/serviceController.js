const petModel = require('../models/petModel');
const serviceModel = require('../models/serviceModel');
const serviceBookingModel = require('../models/serviceBookingModel');

function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isPositiveInteger(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
}

function isValidBookingDate(value, today) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12) return false;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysPerMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysPerMonth[month - 1] && value >= today;
}

function listServices(req, res) {
  const ownerId = req.session.user.id;

  petModel.getPetsByOwner(ownerId, (petError, pets) => {
    if (petError) {
      console.error(petError);
      return res.status(500).send('Unable to load pets.');
    }

    serviceModel.getActiveServices((serviceError, services) => {
      if (serviceError) {
        console.error(serviceError);
        return res.status(500).send('Unable to load services.');
      }

      const requestedPetId = typeof req.query.petId === 'string' ? req.query.petId : '';
      const selectedPet = pets.find((pet) => String(pet.id) === requestedPetId);
      const today = getLocalDateString(new Date());

      return res.render('services', {
        pets,
        services,
        selectedPetId: selectedPet ? String(selectedPet.id) : '',
        today,
        messages: req.flash('success'),
        errors: req.flash('error'),
        session: req.session
      });
    });
  });
}

function createBooking(req, res) {
  const { petId, serviceId, bookingDate } = req.body;
  const today = getLocalDateString(new Date());

  if (!isPositiveInteger(petId) || !isPositiveInteger(serviceId) || !isValidBookingDate(bookingDate, today)) {
    req.flash('error', 'Choose a pet, service, and valid booking date.');
    return res.redirect('/services');
  }

  const ownerId = req.session.user.id;
  serviceBookingModel.createPendingBooking(ownerId, Number(petId), Number(serviceId), bookingDate, (error, booking) => {
    if (error) {
      console.error(error);
      req.flash('error', 'Unable to create the booking. Please try again.');
      return res.redirect(`/services?petId=${encodeURIComponent(petId)}`);
    }

    if (!booking) {
      req.flash('error', 'That pet or service is unavailable for booking.');
      return res.redirect('/services');
    }

    req.flash('success', 'Booking created. Payment is pending; no payment has been processed.');
    return res.redirect('/bookings');
  });
}

function listBookings(req, res) {
  serviceBookingModel.getBookingsByOwner(req.session.user.id, (error, bookings) => {
    if (error) {
      console.error(error);
      return res.status(500).send('Unable to load booking history.');
    }

    return res.render('bookings', {
      bookings,
      messages: req.flash('success'),
      errors: req.flash('error'),
      session: req.session
    });
  });
}

module.exports = { listServices, createBooking, listBookings };
