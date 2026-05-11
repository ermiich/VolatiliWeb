import { useEffect, useRef, useState } from "react";

import client from "../api/client.js";

const usePolling = (url, condition, interval = 2000) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const poll = async () => {
      setLoading(true);
      try {
        const response = await client.get(url);
        if (!isMounted) {
          return;
        }
        setData(response.data);
        setError(null);
        if (condition(response.data)) {
          timerRef.current = setTimeout(poll, interval);
        }
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (url) {
      poll();
    }

    return () => {
      isMounted = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [url, condition, interval]);

  return { data, loading, error };
};

export default usePolling;
