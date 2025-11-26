// Calculate Universal Day Number for Daily Global Numerology Forecast
// Formula: Add all digits of month + day + year, then reduce to single digit (except master numbers 11, 22, 33)
export function calculateUniversalDayNumber(date) {
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate(); // 1-31
  const year = date.getFullYear();
  
  // Add all digits: month + day + year
  const monthDigits = month.toString().split('').reduce((sum, d) => sum + parseInt(d), 0);
  const dayDigits = day.toString().split('').reduce((sum, d) => sum + parseInt(d), 0);
  const yearDigits = year.toString().split('').reduce((sum, d) => sum + parseInt(d), 0);
  
  let total = monthDigits + dayDigits + yearDigits;
  
  // Reduce to single digit, but preserve master numbers 11, 22, 33
  while (total > 9 && total !== 11 && total !== 22 && total !== 33) {
    total = total.toString().split('').reduce((sum, d) => sum + parseInt(d), 0);
  }
  
  return total;
}

// Get numerology forecast description based on Universal Day Number
export function getNumerologyForecast(number) {
  const forecasts = {
    1: {
      number: 1,
      title: 'New Beginnings',
      description: 'Leadership, initiative, and fresh starts tend to receive more focus. A day for taking action and starting new projects.'
    },
    2: {
      number: 2,
      title: 'Cooperation',
      description: 'Cooperation, diplomacy, and partnerships tend to receive more focus. A day for collaboration and building relationships.'
    },
    3: {
      number: 3,
      title: 'Creativity & Communication',
      description: 'Socializing and the arts tend to receive more focus. A day favorable for creative endeavors and effective communication.'
    },
    4: {
      number: 4,
      title: 'Stability & Organization',
      description: 'Practicality, stability, and organization tend to receive more focus. A day for building foundations and structure.'
    },
    5: {
      number: 5,
      title: 'Change & Adventure',
      description: 'Change, adventure, and freedom tend to receive more focus. A day for exploration and embracing new experiences.'
    },
    6: {
      number: 6,
      title: 'Nurturing & Responsibility',
      description: 'Nurturing, responsibility, and domesticity tend to receive more focus. A day for caring for others and home matters.'
    },
    7: {
      number: 7,
      title: 'Introspection & Wisdom',
      description: 'Introspection, wisdom, and seeking knowledge tend to receive more focus. A day for reflection and spiritual growth.'
    },
    8: {
      number: 8,
      title: 'Abundance & Power',
      description: 'Abundance, power, and manifestation tend to receive more focus. A day for achieving goals and material success.'
    },
    9: {
      number: 9,
      title: 'Completion & Compassion',
      description: 'Completion, humanitarianism, and compassion tend to receive more focus. A day for service to others and endings.'
    },
    11: {
      number: 11,
      title: 'Intuition & Inspiration',
      description: 'Intuition, inspiration, and spiritual insight tend to receive more focus. A master number day for higher awareness.'
    },
    22: {
      number: 22,
      title: 'Master Builder',
      description: 'Master building, practical idealism, and large-scale projects tend to receive more focus. A master number day for manifestation.'
    },
    33: {
      number: 33,
      title: 'Master Teacher',
      description: 'Master teaching, compassion, and healing tend to receive more focus. A master number day for service to humanity.'
    }
  };
  
  return forecasts[number] || forecasts[1];
}

