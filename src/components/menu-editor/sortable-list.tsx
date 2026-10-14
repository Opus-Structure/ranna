"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Vertical reorderable list: mouse, touch (press and hold) and keyboard (Space to lift,
 * arrows to move, Space to drop) all work, so reordering never depends on a pointer.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  disabled,
  as = "div",
  rowClassName,
  children,
}: {
  items: T[];
  onReorder: (next: T[]) => void;
  disabled?: boolean;
  /** Row element: "li" when the list sits inside a <ul>. */
  as?: "div" | "li";
  rowClassName?: string;
  children: (item: T, handle: (label: string) => ReactNode) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
        disabled={disabled}
      >
        {items.map((item) => (
          <SortableRow
            key={item.id}
            id={item.id}
            disabled={disabled}
            as={as}
            className={rowClassName}
          >
            {(handle) => children(item, handle)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  disabled,
  as: Tag,
  className,
  children,
}: {
  id: string;
  disabled?: boolean;
  as: "div" | "li";
  className?: string;
  children: (handle: (label: string) => ReactNode) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
  });
  const handle = (label: string) => (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={label}
      disabled={disabled}
      className="grid size-10 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
    >
      <GripVertical className="size-5" aria-hidden />
    </button>
  );
  return (
    <Tag
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative",
        isDragging && "z-10 opacity-90 shadow-[0_12px_30px_-12px_oklch(0.235_0.018_40/0.45)]",
        className,
      )}
    >
      {children(handle)}
    </Tag>
  );
}
