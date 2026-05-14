import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const client = axios.create({
  baseURL,
  timeout: 6000000000
});

export default client;
