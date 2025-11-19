import { useState } from 'react';

function GridCodeOutput({ columns, rows, columnUnit, rowUnit }) {
  const [copied, setCopied] = useState(false);

  const gridTemplateColumns = Array(columns).fill(`1${columnUnit === '1fr' ? 'fr' : columnUnit}`).join(' ');
  const gridTemplateRows = Array(rows).fill(`1${rowUnit === '1fr' ? 'fr' : rowUnit}`).join(' ');

  const cssCode = `.grid-container {
  display: grid;
  grid-template-columns: ${gridTemplateColumns};
  grid-template-rows: ${gridTemplateRows};
  gap: 1rem;
}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cssCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-2">
        <label className="block text-sm font-medium text-gray-700">
          Generated CSS
        </label>
        <button
          type="button"
          onClick={handleCopy}
          className="py-1 px-3 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
        <code>{cssCode}</code>
      </pre>
    </div>
  );
}

export default GridCodeOutput;



