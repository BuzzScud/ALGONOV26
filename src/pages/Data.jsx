import { useState, useEffect } from 'react';
import { getSavedProjections, deleteProjection, updateProjection } from '../services/projectionService';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin
);

function Data() {
  const [projections, setProjections] = useState([]);
  const [selectedProjection, setSelectedProjection] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectionToDelete, setProjectionToDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Chart options matching Projection page
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12,
            weight: '600',
          },
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold',
        },
        bodyFont: {
          size: 13,
        },
        callbacks: {
          label: function(context) {
            if (context.parsed.y !== null && context.parsed.y !== undefined) {
              return `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`;
            }
            return '';
          },
        },
      },
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
            speed: 0.1,
          },
          pinch: {
            enabled: true,
          },
          mode: 'xy',
        },
        pan: {
          enabled: true,
          mode: 'xy',
          modifierKey: null,
        },
        limits: {
          x: { min: 'original', max: 'original' },
          y: { min: 'original', max: 'original' },
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          maxTicksLimit: 20,
          font: {
            size: 11,
          },
          autoSkip: true,
        },
      },
      y: {
        beginAtZero: false,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          drawBorder: false,
        },
        ticks: {
          callback: function(value) {
            if (value !== null && value !== undefined && !isNaN(value)) {
              return '$' + value.toFixed(2);
            }
            return '';
          },
          font: {
            size: 11,
          },
        },
      },
    },
  };

  useEffect(() => {
    loadProjections();
  }, []);

  const loadProjections = () => {
    try {
      const saved = getSavedProjections();
      setProjections(saved);
    } catch (error) {
      console.error('Error loading projections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewProjection = (projection) => {
    setSelectedProjection(projection);
    setShowModal(true);
  };

  const handleDeleteClick = (projection) => {
    setProjectionToDelete(projection);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = () => {
    if (projectionToDelete) {
      try {
        deleteProjection(projectionToDelete.id);
        loadProjections();
        setShowDeleteModal(false);
        setProjectionToDelete(null);
      } catch (error) {
        console.error('Error deleting projection:', error);
        alert('Failed to delete projection');
      }
    }
  };

  const handleLoadProjection = (projection) => {
    // Navigate to projection page with the saved configuration
    navigate('/projection', { state: { loadProjection: projection } });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { timeZone: 'America/New_York' });
  };

  const formatModelName = (model) => {
    const modelNames = {
      'lattice': '12-Fold Lattice',
      'primetetration': 'Prime Tetration',
      'montecarlo': 'Monte Carlo',
    };
    return modelNames[model] || model;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            Saved Projections
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage and view your saved projection configurations
          </p>
        </div>

        <div className="p-6">
          {projections.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No projections saved</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Save projections from the Projection page to view them here.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => navigate('/projection')}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                >
                  Go to Projection Page
                </button>
              </div>
            </div>
          ) : (
            <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
              <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                  <tr>
                    <th scope="col" className="px-6 py-3">
                      Symbol
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Model
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Interval
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Parameters
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Saved At
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {projections.map((projection) => (
                    <tr
                      key={projection.id}
                      className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      <th
                        scope="row"
                        className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white"
                      >
                        {projection.symbol || 'N/A'}
                      </th>
                      <td className="px-6 py-4">
                        {formatModelName(projection.projectionModel)}
                      </td>
                      <td className="px-6 py-4">
                        {projection.interval || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 text-xs">
                          {projection.projectionModel === 'primetetration' && (
                            <>
                              <span>Base: {projection.base || 3}</span>
                              <span>Depth: {projection.primeDepth || 'N/A'}</span>
                              <span>Count: {projection.projectionCount || 12}</span>
                            </>
                          )}
                          {projection.projectionSteps && (
                            <span>Steps: {projection.projectionSteps}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {formatDate(projection.savedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewProjection(projection)}
                            className="font-medium text-blue-600 dark:text-blue-500 hover:underline"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleLoadProjection(projection)}
                            className="font-medium text-green-600 dark:text-green-500 hover:underline"
                          >
                            Load
                          </button>
                          <button
                            onClick={() => handleDeleteClick(projection)}
                            className="font-medium text-red-600 dark:text-red-500 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* View Projection Modal */}
      {showModal && selectedProjection && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          aria-labelledby="modal-title"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowModal(false)}
            ></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
              &#8203;
            </span>

            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4 max-h-[90vh] overflow-y-auto">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3
                      className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4"
                      id="modal-title"
                    >
                      Projection Details: {selectedProjection.symbol}
                    </h3>
                    
                    {/* Price Projection Chart */}
                    {selectedProjection.chartData && selectedProjection.chartData.labels && Array.isArray(selectedProjection.chartData.labels) && selectedProjection.chartData.datasets && Array.isArray(selectedProjection.chartData.datasets) && selectedProjection.chartData.datasets.length > 0 ? (
                      <div className="mb-6 bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                          Price Projection Chart
                        </h4>
                        <div className="h-96 w-full">
                          <Line
                            data={{
                              labels: selectedProjection.chartData.labels || [],
                              datasets: (selectedProjection.chartData.datasets || []).map(dataset => ({
                                ...dataset,
                                data: Array.isArray(dataset.data) ? dataset.data : [],
                              })),
                            }}
                            options={chartOptions}
                          />
                        </div>
                        {selectedProjection.chartData.currentPrice && (
                          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                                Current Price
                              </label>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">
                                ${selectedProjection.chartData.currentPrice.toFixed(2)}
                              </p>
                            </div>
                            {selectedProjection.chartData.change !== undefined && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                                  Change
                                </label>
                                <p className={`text-sm font-bold ${selectedProjection.chartData.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {selectedProjection.chartData.change >= 0 ? '+' : ''}${selectedProjection.chartData.change.toFixed(2)}
                                </p>
                              </div>
                            )}
                            {selectedProjection.chartData.changePercent !== undefined && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                                  Change %
                                </label>
                                <p className={`text-sm font-bold ${selectedProjection.chartData.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {selectedProjection.chartData.changePercent >= 0 ? '+' : ''}{selectedProjection.chartData.changePercent.toFixed(2)}%
                                </p>
                              </div>
                            )}
                            {selectedProjection.chartData.projectedPrice && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                                  Projected Price
                                </label>
                                <p className="text-sm font-bold text-purple-600 dark:text-purple-400">
                                  ${selectedProjection.chartData.projectedPrice.toFixed(2)}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            Chart data not available for this projection. The chart may not have been saved with the projection.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="mt-2 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Model
                          </label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">
                            {formatModelName(selectedProjection.projectionModel)}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Interval
                          </label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">
                            {selectedProjection.interval || 'N/A'}
                          </p>
                        </div>
                        {selectedProjection.projectionModel === 'primetetration' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Base (seed)
                              </label>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                {selectedProjection.base || 3}
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Prime Depth
                              </label>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                {selectedProjection.primeDepth || 'N/A'}
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Projections Count
                              </label>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                {selectedProjection.projectionCount || 12}
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Omega Hz
                              </label>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                {selectedProjection.omegaHz || 432} Hz
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Lambda Schedule
                              </label>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                {selectedProjection.useLambdaSchedule ? 'Enabled' : 'Disabled'}
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Omega Schedule
                              </label>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                {selectedProjection.useOmegaSchedule ? 'Enabled' : 'Disabled'}
                              </p>
                            </div>
                          </>
                        )}
                        {selectedProjection.projectionSteps && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Projection Steps
                            </label>
                            <p className="mt-1 text-sm text-gray-900 dark:text-white">
                              {selectedProjection.projectionSteps}
                            </p>
                          </div>
                        )}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Saved At
                          </label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">
                            {formatDate(selectedProjection.savedAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => handleLoadProjection(selectedProjection)}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Load Projection
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && projectionToDelete && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          aria-labelledby="modal-title"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowDeleteModal(false)}
            ></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
              &#8203;
            </span>

            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 sm:mx-0 sm:h-10 sm:w-10">
                    <svg
                      className="h-6 w-6 text-red-600 dark:text-red-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3
                      className="text-lg leading-6 font-medium text-gray-900 dark:text-white"
                      id="modal-title"
                    >
                      Delete Projection
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Are you sure you want to delete the projection for{' '}
                        <span className="font-medium">{projectionToDelete.symbol}</span>? This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setProjectionToDelete(null);
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Data;
