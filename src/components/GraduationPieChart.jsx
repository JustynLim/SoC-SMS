import React, { useState, useEffect } from "react";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import api from "../services/api";

ChartJS.register(ArcElement, Tooltip, Legend, Title);

const GraduationPieChart = () => {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    const fetchGraduationData = async () => {
      try {
        const response = await api.get("/predictions/all-students");
        const { summary } = response.data;

        const data = {
          labels: ["On-Time", "Late"],
          datasets: [
            {
              label: "Students",
              data: [summary.on_time_predicted, summary.at_risk_predicted],
              backgroundColor: ["#4CAF50", "#F44336"],
              borderColor: ["#FFFFFF", "#FFFFFF"],
              borderWidth: 1,
            },
          ],
        };

        setChartData(data);
      } catch (error) {
        console.error("Error fetching graduation data:", error);
      }
    };

    fetchGraduationData();
  }, []);

  if (!chartData) {
    return <p>Loading graduation data...</p>;
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Students Graduating On-Time",
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            let label = context.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed !== null) {
              label += context.parsed;
            }
            const total = context.dataset.data.reduce((acc, value) => acc + value, 0);
            const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(2) + "%" : "0%";
            label += ` (${percentage})`;
            return label;
          },
        },
      },
    },
  };

  return <Pie data={chartData} options={options} />;
};

export default GraduationPieChart;
