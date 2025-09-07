import React, { useEffect } from 'react';
import { closestCenter, DndContext, PointerSensor, useSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import UserComponent from './UserComponent';

export default function ScheduleDesktopView({
  table,
  setTable,
  datesArr,
  sunday,
  setSunday,
  monday,
  setMonday,
  tuesday,
  setTuesday,
  wednesday,
  setWednesday,
  thursday,
  setThursday,
  friday,
  setFriday,
  saturday,
  setSaturday,
}) {
  const sensors = [useSensor(PointerSensor)];

  const handleDragEnd = ({ active, over }) => {
    if (active.id !== over.id) {
      // 0..6 map to Mon..Sun in this view
      if (active.id.slice(0, 1) === `0`) {
        setMonday((prevTable) => {
          const oldIndex = monday.findIndex((employee) => employee.id === active.id);
          const newIndex = monday.findIndex((employee) => employee.id === over.id);

          return arrayMove(monday, oldIndex, newIndex);
        });
      }
      if (active.id.slice(0, 1) === `1`) {
        setTuesday((prevTable) => {
          const oldIndex = tuesday.findIndex((employee) => employee.id === active.id);
          const newIndex = tuesday.findIndex((employee) => employee.id === over.id);

          return arrayMove(tuesday, oldIndex, newIndex);
        });
      }
      if (active.id.slice(0, 1) === `2`) {
        setWednesday((prevTable) => {
          const oldIndex = wednesday.findIndex((employee) => employee.id === active.id);
          const newIndex = wednesday.findIndex((employee) => employee.id === over.id);

          return arrayMove(wednesday, oldIndex, newIndex);
        });
      }
      if (active.id.slice(0, 1) === `3`) {
        setThursday((prevTable) => {
          const oldIndex = thursday.findIndex((employee) => employee.id === active.id);
          const newIndex = thursday.findIndex((employee) => employee.id === over.id);

          return arrayMove(thursday, oldIndex, newIndex);
        });
      }
      if (active.id.slice(0, 1) === `4`) {
        setFriday((prevTable) => {
          const oldIndex = friday.findIndex((employee) => employee.id === active.id);
          const newIndex = friday.findIndex((employee) => employee.id === over.id);

          return arrayMove(friday, oldIndex, newIndex);
        });
      }
      if (active.id.slice(0, 1) === `5`) {
        setSaturday((prevTable) => {
          const oldIndex = saturday.findIndex((employee) => employee.id === active.id);
          const newIndex = saturday.findIndex((employee) => employee.id === over.id);

          return arrayMove(saturday, oldIndex, newIndex);
        });
      }
      if (active.id.slice(0, 1) === `6`) {
        setSunday((prevTable) => {
          const oldIndex = sunday.findIndex((employee) => employee.id === active.id);
          const newIndex = sunday.findIndex((employee) => employee.id === over.id);

          return arrayMove(sunday, oldIndex, newIndex);
        });
      }
    }
  };

  const iterateDays = (i) => {
    let day;
    switch (i) {
      case 0:
        day = monday; break;
      case 1:
        day = tuesday; break;
      case 2:
        day = wednesday; break;
      case 3:
        day = thursday; break;
      case 4:
        day = friday; break;
      case 5:
        day = saturday; break;
      case 6:
        day = sunday; break;
      default:
        day = [];
    }

    return (
      <div key={`column-${i}`}>
        <SortableContext
          items={day.map((employee) => employee.id)}
          strategy={verticalListSortingStrategy}
          key={`sortable-context-${i}`}
        >
          {day.map((employee, i) => (
            <UserComponent name={employee.username} id={employee.id} key={`${employee.id}-${i}`} />
          ))}
        </SortableContext>
      </div>
    );
  };

  return (
    <>
      <div className="grid grid-cols-7">
        {table && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            key="dnd-context-0"
          >
            {[...Array(7)].map((_, i) => {
              return iterateDays(i);
            })}
          </DndContext>
        )}
      </div>
    </>
  );
}
