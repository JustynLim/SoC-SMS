import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom"; //new

export default function useStudentsData() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation(); //new dont put location inside [] as the value is array-destructured

  // New
  const resolveEndpoint = (pathname) => {
    if (pathname.startsWith("/students-scores")){
      return "http://localhost:5001/api/students-scores";
    }
    return "http://localhost:5001/api/students";
  };

    useEffect(() => {
    const controller = new AbortController();
    const url = resolveEndpoint(location.pathname);

    setLoading(true);
    setError(null);

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setData(Array.isArray(json) ? json : []);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [location.pathname]);

  return { data, loading, error, setData };
}