import axios from "axios";
import Cookies from "js-cookie";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const axiosClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "ngrok-skip-browser-warning": "true"
    }
})

axiosClient.interceptors.request.use(config => {
    const token = Cookies.get("accessToken");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
})

axiosClient.interceptors.response.use(
    response => {
        return response;
    },
    error => {
        const { response } = error;
        if (response && response.status === 401) {
            Cookies.remove('accessToken');
            Cookies.remove('currentUser');
        }
        return Promise.reject(error);
    }
)

export default axiosClient;