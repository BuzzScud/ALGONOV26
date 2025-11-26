// Projection Service - Save and load projection data
const STORAGE_KEY = 'savedProjections';

// Get all saved projections
export const getSavedProjections = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading saved projections:', error);
  }
  return [];
};

// Save a new projection
export const saveProjection = (projectionData) => {
  try {
    const projections = getSavedProjections();
    const newProjection = {
      id: Date.now().toString(),
      ...projectionData,
      savedAt: new Date().toISOString(),
    };
    projections.push(newProjection);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projections));
    return newProjection;
  } catch (error) {
    console.error('Error saving projection:', error);
    throw error;
  }
};

// Delete a projection
export const deleteProjection = (id) => {
  try {
    const projections = getSavedProjections();
    const filtered = projections.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return { success: true };
  } catch (error) {
    console.error('Error deleting projection:', error);
    throw error;
  }
};

// Update a projection
export const updateProjection = (id, updates) => {
  try {
    const projections = getSavedProjections();
    const index = projections.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('Projection not found');
    }
    projections[index] = {
      ...projections[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projections));
    return projections[index];
  } catch (error) {
    console.error('Error updating projection:', error);
    throw error;
  }
};

// Get a single projection by ID
export const getProjection = (id) => {
  try {
    const projections = getSavedProjections();
    return projections.find(p => p.id === id);
  } catch (error) {
    console.error('Error getting projection:', error);
    return null;
  }
};

