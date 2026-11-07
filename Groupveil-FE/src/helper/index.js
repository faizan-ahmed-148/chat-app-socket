import axios from "axios";


export const register_firebase_token = async (
    firebase_token,
    token,
    BASE_URL
  ) => {
    const data = {
        firebase_token,
    }
  
    try {
      // Simulate API call for registration
      let response = await axios.post(
        `${BASE_URL}/messages/registerFirebaseToken`,
        data,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log(response, "==>response");
  
      return response;
    } catch (error) {
      console.log(error, "==>response");
  
    } 
  };