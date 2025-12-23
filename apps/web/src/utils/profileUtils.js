/**
 * Profile completion utilities
 * Checks if user profile has all required fields filled
 */

/**
 * Check if user profile is complete with all required fields
 * Required fields: name, email, gender, college_name, university, year, semester
 * @param {Object} userInfo - User information object
 * @returns {boolean} - True if profile is complete, false otherwise
 */
export const isProfileComplete = (userInfo) => {
  if (!userInfo) {
    return false;
  }

  // Check all required fields are present and not empty
  const requiredFields = [
    userInfo.name,
    userInfo.email,
    userInfo.gender,
    userInfo.college_name,
    userInfo.university,
    userInfo.year,
    userInfo.semester
  ];

  // All fields must be present and not empty strings
  return requiredFields.every(field => 
    field !== null && 
    field !== undefined && 
    String(field).trim() !== ''
  );
};

/**
 * Get missing profile fields
 * @param {Object} userInfo - User information object
 * @returns {Array} - Array of missing field names
 */
export const getMissingProfileFields = (userInfo) => {
  if (!userInfo) {
    return ['name', 'email', 'gender', 'college_name', 'university', 'year', 'semester'];
  }

  const missingFields = [];
  
  if (!userInfo.name || String(userInfo.name).trim() === '') {
    missingFields.push('name');
  }
  if (!userInfo.email || String(userInfo.email).trim() === '') {
    missingFields.push('email');
  }
  if (!userInfo.gender || String(userInfo.gender).trim() === '') {
    missingFields.push('gender');
  }
  if (!userInfo.college_name || String(userInfo.college_name).trim() === '') {
    missingFields.push('college_name');
  }
  if (!userInfo.university || String(userInfo.university).trim() === '') {
    missingFields.push('university');
  }
  if (!userInfo.year) {
    missingFields.push('year');
  }
  if (!userInfo.semester) {
    missingFields.push('semester');
  }

  return missingFields;
};

/**
 * Check profile completion from API response
 * @param {Object} apiResponse - API response containing user_info
 * @returns {boolean} - True if profile is complete, false otherwise
 */
export const checkProfileCompletionFromAPI = (apiResponse) => {
  if (!apiResponse || !apiResponse.user_info) {
    return false;
  }
  
  return isProfileComplete(apiResponse.user_info);
};

export default {
  isProfileComplete,
  getMissingProfileFields,
  checkProfileCompletionFromAPI
};

