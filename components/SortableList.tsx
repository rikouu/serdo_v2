import React, { ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortableItem {
  id: string;
  sortOrder?: number;
  createdAt?: number;
}

interface SortableListProps<T extends SortableItem> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, dragHandleProps: DragHandleProps) => ReactNode;
  layout?: 'grid' | 'list';
  gridClassName?: string;
  disabled?: boolean;
}

export interface DragHandleProps {
  attributes: Record<string, any>;
  listeners: Record<string, any> | undefined;
  isDragging: boolean;
}

interface SortableItemWrapperProps {
  id: string;
  children: (props: DragHandleProps) => ReactNode;
  disabled?: boolean;
}

function SortableItemWrapper({ id, children, disabled }: SortableItemWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}

export function DragHandle({ 
  attributes, 
  listeners, 
  className = '',
  disabled = false,
}: DragHandleProps & { className?: string; disabled?: boolean }) {
  if (disabled) return null;
  
  return (
    <button
      type="button"
      className={`cursor-grab active:cursor-grabbing touch-none p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors ${className}`}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="w-4 h-4" />
    </button>
  );
}

export function SortableList<T extends SortableItem>({
  items,
  onReorder,
  renderItem,
  layout = 'list',
  gridClassName = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
  disabled = false,
}: SortableListProps<T>) {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      
      const newItems = arrayMove(items, oldIndex, newIndex);
      
      const reorderedItems = newItems.map((item, index) => ({
        ...item,
        sortOrder: index,
      }));
      
      onReorder(reorderedItems);
    }
  };

  const activeItem = activeId ? items.find((item) => item.id === activeId) : null;

  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
        return a.sortOrder - b.sortOrder;
      }
      if (a.createdAt !== undefined && b.createdAt !== undefined) {
        return a.createdAt - b.createdAt;
      }
      return 0;
    });
  }, [items]);

  if (disabled) {
    return (
      <div className={layout === 'grid' ? gridClassName : 'space-y-3'}>
        {sortedItems.map((item) => (
          <div key={item.id}>
            {renderItem(item, { attributes: {}, listeners: undefined, isDragging: false })}
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sortedItems.map((item) => item.id)}
        strategy={layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
      >
        <div className={layout === 'grid' ? gridClassName : 'space-y-3'}>
          {sortedItems.map((item) => (
            <SortableItemWrapper key={item.id} id={item.id} disabled={disabled}>
              {(dragHandleProps) => renderItem(item, dragHandleProps)}
            </SortableItemWrapper>
          ))}
        </div>
      </SortableContext>
      
      <DragOverlay>
        {activeItem ? (
          <div className="opacity-90 shadow-2xl scale-105">
            {renderItem(activeItem, { attributes: {}, listeners: undefined, isDragging: true })}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export function SortableTableRow({ id, children, disabled }: { id: string; children: ReactNode; disabled?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? '#f8fafc' : undefined,
  };

  return (
    <tr ref={setNodeRef} style={style} className={isDragging ? 'shadow-lg' : ''}>
      {!disabled && (
        <td className="w-8 px-2">
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing touch-none p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-4 h-4" />
          </button>
        </td>
      )}
      {children}
    </tr>
  );
}

interface SortableTableProps<T extends SortableItem> {
  items: T[];
  onReorder: (items: T[]) => void;
  children: ReactNode;
  disabled?: boolean;
}

export function SortableTable<T extends SortableItem>({
  items,
  onReorder,
  children,
  disabled = false,
}: SortableTableProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      
      const newItems = arrayMove(items, oldIndex, newIndex);
      
      const reorderedItems = newItems.map((item, index) => ({
        ...item,
        sortOrder: index,
      }));
      
      onReorder(reorderedItems);
    }
  };

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  );
}

export function sortByOrder<T extends SortableItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
      return a.sortOrder - b.sortOrder;
    }
    if (a.createdAt !== undefined && b.createdAt !== undefined) {
      return a.createdAt - b.createdAt;
    }
    return 0;
  });
}

export function initializeSortOrder<T extends SortableItem>(items: T[]): T[] {
  return items.map((item, index) => ({
    ...item,
    sortOrder: item.sortOrder ?? index,
    createdAt: item.createdAt ?? Date.now() - (items.length - index) * 1000,
  }));
}
