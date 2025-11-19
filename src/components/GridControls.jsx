function GridControls({ columns, rows, columnUnit, rowUnit, onColumnsChange, onRowsChange, onColumnUnitChange, onRowUnitChange }) {
  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Columns
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            max="12"
            value={columns}
            onChange={(e) => onColumnsChange(parseInt(e.target.value) || 1)}
            className="flex-1 py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <select
            value={columnUnit}
            onChange={(e) => onColumnUnitChange(e.target.value)}
            className="py-2 px-3 block border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="fr">fr</option>
            <option value="px">px</option>
            <option value="%">%</option>
            <option value="auto">auto</option>
            <option value="1fr">1fr</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Rows
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            max="12"
            value={rows}
            onChange={(e) => onRowsChange(parseInt(e.target.value) || 1)}
            className="flex-1 py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <select
            value={rowUnit}
            onChange={(e) => onRowUnitChange(e.target.value)}
            className="py-2 px-3 block border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="fr">fr</option>
            <option value="px">px</option>
            <option value="%">%</option>
            <option value="auto">auto</option>
            <option value="1fr">1fr</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export default GridControls;


