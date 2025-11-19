import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-move">
      {children}
    </div>
  );
}

function GridPreview({ columns, rows, columnUnit, rowUnit, items, onItemsChange }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const gridTemplateColumns = Array(columns).fill(`1${columnUnit === '1fr' ? 'fr' : columnUnit}`).join(' ');
  const gridTemplateRows = Array(rows).fill(`1${rowUnit === '1fr' ? 'fr' : rowUnit}`).join(' ');

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      onItemsChange(arrayMove(items, oldIndex, newIndex));
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div
        className="grid gap-2 min-h-[400px]"
        style={{
          gridTemplateColumns,
          gridTemplateRows,
        }}
      >
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
            {items.map((item) => (
              <SortableItem key={item.id} id={item.id}>
                <div className="bg-blue-500 text-white p-4 rounded-lg flex items-center justify-center font-semibold">
                  {item.label}
                </div>
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

export default GridPreview;



