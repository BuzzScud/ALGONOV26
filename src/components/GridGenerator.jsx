import { useState } from 'react';
import GridControls from './GridControls';
import GridPreview from './GridPreview';
import GridCodeOutput from './GridCodeOutput';

function GridGenerator() {
  const [columns, setColumns] = useState(3);
  const [rows, setRows] = useState(3);
  const [columnUnit, setColumnUnit] = useState('fr');
  const [rowUnit, setRowUnit] = useState('fr');
  const [items, setItems] = useState(() => {
    const initialItems = [];
    for (let i = 1; i <= 9; i++) {
      initialItems.push({ id: `item-${i}`, label: `Item ${i}` });
    }
    return initialItems;
  });

  const handleAddItem = () => {
    const newId = `item-${Date.now()}`;
    setItems([...items, { id: newId, label: `Item ${items.length + 1}` }]);
  };

  const handleRemoveItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleReset = () => {
    setColumns(3);
    setRows(3);
    setColumnUnit('fr');
    setRowUnit('fr');
    const resetItems = [];
    for (let i = 1; i <= 9; i++) {
      resetItems.push({ id: `item-${i}`, label: `Item ${i}` });
    }
    setItems(resetItems);
  };

  return (
    <div>
      <GridControls
        columns={columns}
        rows={rows}
        columnUnit={columnUnit}
        rowUnit={rowUnit}
        onColumnsChange={setColumns}
        onRowsChange={setRows}
        onColumnUnitChange={setColumnUnit}
        onRowUnitChange={setRowUnit}
      />

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={handleAddItem}
          className="py-2 px-4 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Add Item
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Reset
        </button>
      </div>

      <GridPreview
        columns={columns}
        rows={rows}
        columnUnit={columnUnit}
        rowUnit={rowUnit}
        items={items}
        onItemsChange={setItems}
      />

      <GridCodeOutput
        columns={columns}
        rows={rows}
        columnUnit={columnUnit}
        rowUnit={rowUnit}
      />
    </div>
  );
}

export default GridGenerator;

