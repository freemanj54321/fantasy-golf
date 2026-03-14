export const generateCreativeTeamName = async (): Promise<string> => {
  // In a real app, this would call a generative AI service.
  // For this mock, we'll return a random creative name.
  const creativeNames = [
    'The Fairway Phantoms',
    'The Green Guardians',
    'The Driving Dreamers',
    'The Putting Prodigies',
    'The Bunker Busters',
    'The Eagle Express',
    'The Albatross Armada',
  ];
  return new Promise(resolve => {
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * creativeNames.length);
      resolve(creativeNames[randomIndex]);
    }, 1000);
  });
};
