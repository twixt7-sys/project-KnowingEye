import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";

import type { Question } from "@/core/config/api";
import { BuilderIconBtn } from "@/features/exams/components/builder/builder-primitives";

interface SortableQuestionRowProps {
  question: Question;
  isDraft: boolean;
  onEdit: (q: Question) => void;
  onDelete: (q: Question) => void;
}

function SortableQuestionRow({ question, isDraft, onEdit, onDelete }: SortableQuestionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
    disabled: !isDraft,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="p-4 flex gap-4 items-start">
      {isDraft && (
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label={`Drag question ${question.order}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      <div className="text-sm font-mono text-muted-foreground w-8">Q{question.order}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{question.question_text}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {question.question_type.replace("_", " ")} · {question.points} pt(s)
          {question.question_type === "multiple_choice" && question.options?.length
            ? ` · ${question.options.length} options`
            : ""}
          {question.attachments?.length ? ` · ${question.attachments.length} attachment(s)` : ""}
        </p>
      </div>
      {isDraft && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(question)}
            className="text-xs px-2 py-1 border border-border rounded hover:bg-accent"
          >
            Edit
          </button>
          <BuilderIconBtn onClick={() => onDelete(question)} label="Delete">
            <Trash2 className="w-4 h-4 text-red-500" />
          </BuilderIconBtn>
        </div>
      )}
    </div>
  );
}

interface SortableQuestionListProps {
  questions: Question[];
  isDraft: boolean;
  onEdit: (q: Question) => void;
  onDelete: (q: Question) => void;
  onReorder: (questionIds: number[]) => void;
}

export function SortableQuestionList({
  questions,
  isDraft,
  onEdit,
  onDelete,
  onReorder,
}: SortableQuestionListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(questions, oldIndex, newIndex);
    onReorder(reordered.map((q) => q.id));
  };

  if (questions.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground text-sm">
        No questions yet. Add manually or import from CSV below.
      </div>
    );
  }

  if (!isDraft) {
    return (
      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {questions.map((q) => (
          <SortableQuestionRow
            key={q.id}
            question={q}
            isDraft={false}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {questions.map((q) => (
            <SortableQuestionRow
              key={q.id}
              question={q}
              isDraft={isDraft}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
