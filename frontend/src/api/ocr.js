import apiClient from "./apiClient";

/**
 * LAYER 3 Frontend Integration
 * Send image to OCR endpoint and get structured data back
 */
 
export const processOCR = (formData) => {
  return apiClient
    .post("/ocr/process-credit-sale/", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })
    .then((response) => response.data)
    .catch((error) => {
      throw error.response?.data || error;
    });
};

export const uploadImageForOCR = (imageFile) => {
  const formData = new FormData();
  formData.append("image", imageFile);
  return processOCR(formData);
};
