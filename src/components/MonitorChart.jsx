import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { getMonitorChartData } from '../services/monitorService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function MonitorChart({ monitorId }) {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChartData();
    const interval = setInterval(loadChartData, 30000);
    return () => clearInterval(interval);
  }, [monitorId]);

  const loadChartData = async () => {
    try {
      const data = await getMonitorChartData(monitorId, 'response-time');
      // Handle UptimeKit API response format
      // API returns array of { time, value } or { timestamp, responseTime }
      const labels = data.map((d) => {
        const time = d.time || d.timestamp;
        return new Date(time).toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
      });
      const values = data.map((d) => d.value || d.responseTime || 0);

      setChartData({
        labels,
        datasets: [
          {
            label: 'Response Time (ms)',
            data: values,
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
          },
        ],
      });
    } catch (error) {
      console.error('Failed to load chart data:', error);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !chartData) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-500">
        Loading chart...
      </div>
    );
  }

  return (
    <div className="h-48">
      <Line
        data={chartData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
            },
          },
        }}
      />
    </div>
  );
}

export default MonitorChart;

