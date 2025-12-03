import { useState, useEffect, useMemo } from 'react';
import { getSavedProjections, deleteProjection } from '../services/projectionService';
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

const PROJECTION_COLORS = [
  { name: 'Blue', bg: 'from-blue-50 to-blue-100', border: 'border-blue-200', dark: 'dark:from-blue-900/20 dark:to-blue-800/20 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300' },
  { name: 'Green', bg: 'from-green-50 to-green-100', border: 'border-green-200', dark: 'dark:from-green-900/20 dark:to-green-800/20 dark:border-green-800', text: 'text-green-700 dark:text-green-300' },
  { name: 'Purple', bg: 'from-purple-50 to-purple-100', border: 'border-purple-200', dark: 'dark:from-purple-900/20 dark:to-purple-800/20 dark:border-purple-800', text: 'text-purple-700 dark:text-purple-300' },
  { name: 'Yellow', bg: 'from-yellow-50 to-yellow-100', border: 'border-yellow-200', dark: 'dark:from-yellow-900/20 dark:to-yellow-800/20 dark:border-yellow-800', text: 'text-yellow-700 dark:text-yellow-300' },
  { name: 'Pink', bg: 'from-pink-50 to-pink-100', border: 'border-pink-200', dark: 'dark:from-pink-900/20 dark:to-pink-800/20 dark:border-pink-800', text: 'text-pink-700 dark:text-pink-300' },
  { name: 'Indigo', bg: 'from-indigo-50 to-indigo-100', border: 'border-indigo-200', dark: 'dark:from-indigo-900/20 dark:to-indigo-800/20 dark:border-indigo-800', text: 'text-indigo-700 dark:text-indigo-300' },
];

function Data() {
  const [projections, setProjections] = useState([]);
  const [selectedProjection, setSelectedProjection] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectionToDelete, setProjectionToDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date'); // date, symbol, model
  const [filterModel, setFilterModel] = useState('all'); // all, lattice, primetetration, montecarlo
  const [viewMode, setViewMode] = useState('grid'); // grid, list
  const [selectedProjections, setSelectedProjections] = useState([]);
  const [showStats, setShowStats] = useState(true);
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
      setLoading(true);
      setError(null);
      const saved = getSavedProjections();
      setProjections(saved || []);
    } catch (error) {
      console.error('Error loading projections:', error);
      setError('Failed to load projections');
    } finally {
      setLoading(false);
    }
  };

  // Get all unique models from projections
  const allModels = useMemo(() => {
    const models = new Set();
    projections.forEach(proj => {
      if (proj.projectionModel) {
        models.add(proj.projectionModel);
      }
    });
    return Array.from(models).sort();
  }, [projections]);

  // Filtered and sorted projections
  const filteredProjections = useMemo(() => {
    let filtered = [...projections];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(proj => 
        proj.symbol?.toLowerCase().includes(query) ||
        proj.projectionModel?.toLowerCase().includes(query) ||
        proj.interval?.toLowerCase().includes(query)
      );
    }

    // Model filter
    if (filterModel !== 'all') {
      filtered = filtered.filter(proj => 
        proj.projectionModel === filterModel
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'symbol':
          return (a.symbol || '').localeCompare(b.symbol || '');
        case 'model':
          return (a.projectionModel || '').localeCompare(b.projectionModel || '');
        case 'date':
        default:
          return new Date(b.savedAt || 0) - new Date(a.savedAt || 0);
      }
    });

    return filtered;
  }, [projections, searchQuery, filterModel, sortBy]);

  // Statistics
  const stats = useMemo(() => {
    const total = projections.length;
    const byModel = {
      lattice: projections.filter(p => p.projectionModel === 'lattice').length,
      primetetration: projections.filter(p => p.projectionModel === 'primetetration').length,
      montecarlo: projections.filter(p => p.projectionModel === 'montecarlo').length,
    };
    const withCharts = projections.filter(p => p.chartData && p.chartData.labels && p.chartData.labels.length > 0).length;
    const withoutCharts = total - withCharts;
    const totalSymbols = new Set(projections.map(p => p.symbol).filter(Boolean)).size;

    return { total, byModel, withCharts, withoutCharts, totalSymbols };
  }, [projections]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatModelName = (model) => {
    const modelNames = {
      'lattice': '12-Fold Lattice',
      'primetetration': 'Prime Tetration',
      'montecarlo': 'Monte Carlo',
    };
    return modelNames[model] || model || 'Unknown';
  };

  const getProjectionColor = (index) => {
    return PROJECTION_COLORS[index % PROJECTION_COLORS.length];
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
        setSelectedProjections(prev => prev.filter(id => id !== projectionToDelete.id));
        loadProjections();
        setShowDeleteModal(false);
        setProjectionToDelete(null);
      } catch (error) {
        console.error('Error deleting projection:', error);
        setError('Failed to delete projection');
      }
    }
  };

  const handleBulkDelete = () => {
    if (selectedProjections.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedProjections.length} projection(s)?`)) {
      return;
    }
    try {
      selectedProjections.forEach(id => {
        try {
          deleteProjection(id);
        } catch (err) {
          console.error('Error deleting projection:', err);
        }
      });
      setSelectedProjections([]);
      loadProjections();
    } catch (err) {
      console.error('Failed to delete projections:', err);
      setError('Failed to delete projections');
    }
  };

  const handleLoadProjection = (projection) => {
    navigate('/projection', { state: { loadProjection: projection } });
  };

  const toggleSelectProjection = (id) => {
    setSelectedProjections(prev => 
      prev.includes(id) 
        ? prev.filter(n => n !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProjections.length === filteredProjections.length) {
      setSelectedProjections([]);
    } else {
      setSelectedProjections(filteredProjections.map(p => p.id));
    }
  };

  const exportData = () => {
    const dataStr = JSON.stringify(projections, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `projections-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Saved Projections</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage and view your saved projection configurations and charts
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/projection')}
              className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Projection
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        {showStats && projections.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Total</span>
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.total}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-green-700 dark:text-green-300">12-Fold Lattice</span>
                <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.byModel.lattice}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-purple-700 dark:text-purple-300">Prime Tetration</span>
                <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.byModel.primetetration}</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">Monte Carlo</span>
                <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{stats.byModel.montecarlo}</p>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-xl p-4 border border-indigo-200 dark:border-indigo-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">With Charts</span>
                <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">{stats.withCharts}</p>
            </div>
            <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 rounded-xl p-4 border border-pink-200 dark:border-pink-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-pink-700 dark:text-pink-300">Filtered</span>
                <svg className="w-4 h-4 text-pink-600 dark:text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-pink-900 dark:text-pink-100">{filteredProjections.length}</p>
            </div>
          </div>
        )}

        {/* Controls Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projections by symbol, model, or interval..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Filters and Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Model Filter */}
              <select
                value={filterModel}
                onChange={(e) => setFilterModel(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
              >
                <option value="all">All Models</option>
                {allModels.map(model => (
                  <option key={model} value={model}>{formatModelName(model)}</option>
                ))}
              </select>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
              >
                <option value="date">Sort by Date</option>
                <option value="symbol">Sort by Symbol</option>
                <option value="model">Sort by Model</option>
              </select>

              {/* View Mode */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}
                  title="Grid View"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}
                  title="List View"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>

              {/* Export */}
              <button
                type="button"
                onClick={exportData}
                className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2"
                title="Export Data"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
              </button>

              {/* Toggle Stats */}
              <button
                type="button"
                onClick={() => setShowStats(!showStats)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title={showStats ? "Hide Statistics" : "Show Statistics"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedProjections.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedProjections.length} projection(s) selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                >
                  Delete All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProjections([])}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-600 dark:text-red-300 hover:text-red-800 dark:hover:text-red-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Projections Display */}
      {loading && projections.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading projections...</p>
        </div>
      ) : filteredProjections.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <svg
            className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
            />
          </svg>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {searchQuery || filterModel !== 'all' ? 'No projections found' : 'No projections saved'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {searchQuery || filterModel !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'Save projections from the Projection page to view them here'}
          </p>
          {(!searchQuery && filterModel === 'all') && (
            <button
              type="button"
              onClick={() => navigate('/projection')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Projection Page
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Select All Checkbox */}
          {filteredProjections.length > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedProjections.length === filteredProjections.length && filteredProjections.length > 0}
                onChange={toggleSelectAll}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label className="text-sm text-gray-600 dark:text-gray-400">
                Select all ({filteredProjections.length})
              </label>
            </div>
          )}

          {/* Grid/List View */}
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
            : 'space-y-4'
          }>
            {filteredProjections.map((projection, index) => {
              const color = getProjectionColor(index);
              return (
                <div
                  key={projection.id}
                  className={`relative bg-gradient-to-br ${color.bg} ${color.dark} rounded-xl p-5 border ${color.border} ${color.dark} shadow-md hover:shadow-lg transition-all ${
                    selectedProjections.includes(projection.id) ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  {viewMode === 'list' && (
                    <input
                      type="checkbox"
                      checked={selectedProjections.includes(projection.id)}
                      onChange={() => toggleSelectProjection(projection.id)}
                      className="absolute top-4 left-4 z-10 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                        {projection.symbol || 'N/A'}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {formatDate(projection.savedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewProjection(projection);
                        }}
                        className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white/50 dark:hover:bg-gray-800/50 rounded transition-colors"
                        title="View Projection"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(projection);
                        }}
                        className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-white/50 dark:hover:bg-gray-800/50 rounded transition-colors"
                        title="Delete Projection"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Model:</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatModelName(projection.projectionModel)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Interval:</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {projection.interval || 'N/A'}
                      </span>
                    </div>
                    {projection.projectionModel === 'primetetration' && (
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-2 py-0.5 text-xs font-medium bg-white/60 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 rounded-full">
                          Base: {projection.base || 3}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-medium bg-white/60 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 rounded-full">
                          Depth: {projection.primeDepth || 'N/A'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/30 dark:border-gray-700/30">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoadProjection(projection);
                        }}
                        className="px-3 py-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 rounded-lg transition-colors"
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewProjection(projection);
                        }}
                        className="px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                      >
                        View
                      </button>
                    </div>
                    {viewMode === 'grid' && (
                      <input
                        type="checkbox"
                        checked={selectedProjections.includes(projection.id)}
                        onChange={() => toggleSelectProjection(projection.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Results Count */}
          {filteredProjections.length !== projections.length && (
            <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
              Showing {filteredProjections.length} of {projections.length} projections
            </div>
          )}
        </>
      )}

      {/* View Projection Modal */}
      {showModal && selectedProjection && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowModal(false)}></div>
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4 max-h-[90vh] overflow-y-auto">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
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
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowDeleteModal(false)}></div>
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
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
