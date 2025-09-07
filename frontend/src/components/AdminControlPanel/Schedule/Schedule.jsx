import { useState, useEffect } from 'react';
import axios from 'axios';
import { format, addDays, eachDayOfInterval, nextMonday } from 'date-fns';
import ScheduleDesktopView from './ScheduleDesktopView';
import { useUserContext } from '../../useUserContext';
import { useUsersContext } from '../useUsersContext';
import Msg from './../../general/Msg';
import { Alert } from '@mantine/core';
import { FiAlertCircle } from 'react-icons/fi';

const Schedule = () => {
  const { user } = useUserContext();
  const { users, refreshAllUsers } = useUsersContext();
  const [status, setStatus] = useState(null);
  const [button, setButton] = useState(true);
  const [importing, setImporting] = useState(false);

  const [datesArr, setDatesArr] = useState(null);
  const [table, setTable] = useState(null);
  const [sunday, setSunday] = useState(null);
  const [monday, setMonday] = useState(null);
  const [tuesday, setTuesday] = useState(null);
  const [wednesday, setWednesday] = useState(null);
  const [thursday, setThursday] = useState(null);
  const [friday, setFriday] = useState(null);
  const [saturday, setSaturday] = useState(null);

  useEffect(() => {
    refreshAllUsers();
    const start = nextMonday(new Date());
    const end = addDays(start, 6);
    setDatesArr(eachDayOfInterval({ start, end }));
  }, []);

  const handleSubmit = (e) => e.preventDefault();

  const applyScheduleToState = (schedule) => {
    if (!Array.isArray(schedule) || schedule.length < 7) return;
    const scheduleUID = schedule.map((day, dayIndex) =>
      day.map((employeeData, employeeIndex) => {
        const id = employeeData.id || `${dayIndex}-${employeeIndex}`;
        return { ...employeeData, id };
      })
    );
    setTable(scheduleUID);
    setMonday(scheduleUID[0]);
    setTuesday(scheduleUID[1]);
    setWednesday(scheduleUID[2]);
    setThursday(scheduleUID[3]);
    setFriday(scheduleUID[4]);
    setSaturday(scheduleUID[5]);
    setSunday(scheduleUID[6]);
  };

  const handleImport = async (e) => {
    e.preventDefault();
    try {
      setImporting(true);
      const res = await axios.post('/import-schedule?dryRun=true');
      if (res.data && Array.isArray(res.data.schedule)) {
        applyScheduleToState(res.data.schedule);
        setStatus({ OK: true, bolded: 'Done!', msg: 'Imported schedule preview loaded' });
      } else {
        setStatus({ OK: false, bolded: 'Error!', msg: 'No schedule returned from Google' });
      }
    } catch (err) {
      setStatus({ OK: false, bolded: 'Error!', msg: 'Failed to import from Google Calendar' });
    } finally {
      setImporting(false);
    }
  };

  const uploadSchedule = async (e) => {
    e.preventDefault();
    setButton(false);
    setTimeout(() => setButton(true), 3000);
    try {
      const savedSchedule = [
        monday || [],
        tuesday || [],
        wednesday || [],
        thursday || [],
        friday || [],
        saturday || [],
        sunday || [],
      ];
      const savedBy = user.username;
      const response = await axios.post('/postSchedule', { savedSchedule, savedBy });
      if (response.data === 'Success') {
        setStatus({ OK: true, bolded: 'Done!', msg: 'Schedule published successfully' });
      } else {
        setStatus({ OK: false, bolded: 'Error!', msg: 'Schedule was not published' });
      }
    } catch (err) {
      setStatus({ OK: false, bolded: 'Error!', msg: 'Failed to publish schedule' });
    }
  };

  const formatDay = (date) => format(date, 'd LLLL');

  const days = {
    sunday,
    monday,
    tuesday,
    wednesday,
    thursday,
    friday,
    saturday,
    setSunday,
    setMonday,
    setTuesday,
    setWednesday,
    setThursday,
    setFriday,
    setSaturday,
  };

  return (
    <>
      <div>
        <div className="grid mt-5 place-items-center">
          <div className="flex justify-between w-11/12 lg:w-4/6 flex-end">
            <h1 className="text-3xl font-semibold">Create New Work Schedule</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={handleImport}
                className="px-3 py-2 text-base font-semibold text-white rounded-full bg-emerald-600 focus:outline-none focus:ring focus:ring-emerald-300 hover:bg-emerald-700 disabled:opacity-60"
                disabled={importing}
              >
                {importing ? 'Importing…' : 'Import from Google Calendar'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex lg:grid lg:place-items-center md:grid md:place-items-center ">
          {users && users.length <= 6 && (
            <div className="flex justify-center mt-5">
              <div>
                <Alert icon={<FiAlertCircle />} title="Warning" color="yellow">
                  <p>Detected a small number of registered users.</p>
                  <p>With fewer than 4 non-admin users, automatic scheduling may not work well.</p>
                </Alert>
              </div>
            </div>
          )}
          <div className="hidden w-full mt-10 md:block md:w-5/6 lg:w-4/6">
            {table ? (
              <div className="text-xl">
                <div className="grid grid-cols-7 font-bold">
                  <div className="p-2 border-b wrap">
                    Monday
                    <span className="block text-sm font-normal break-words">{datesArr && formatDay(datesArr[0])}</span>
                  </div>
                  <div className="table-cell p-2 border-b">
                    Tuesday <span className="block text-sm font-normal">{datesArr && formatDay(datesArr[1])}</span>
                  </div>
                  <div className="table-cell p-2 border-b">
                    Wednesday<span className="block text-sm font-normal">{datesArr && formatDay(datesArr[2])}</span>
                  </div>
                  <div className="table-cell p-2 border-b">
                    Thursday<span className="block text-sm font-normal">{datesArr && formatDay(datesArr[3])}</span>
                  </div>
                  <div className="table-cell p-2 border-b">
                    Friday<span className="block text-sm font-normal">{datesArr && formatDay(datesArr[4])}</span>
                  </div>
                  <div className="table-cell p-2 border-b">
                    Saturday<span className="block text-sm font-normal">{datesArr && formatDay(datesArr[5])}</span>
                  </div>
                  <div className="table-cell p-2 border-b">
                    Sunday<span className="block text-sm font-normal">{datesArr && formatDay(datesArr[6])}</span>
                  </div>
                </div>
              </div>
            ) : (
              <h3 className="text-lg text-center">Use "Import from Google Calendar" to load this week's shifts.</h3>
            )}

            <ScheduleDesktopView table={table} setTable={setTable} datesArr={datesArr} {...days} />
          </div>
        </div>

        {!table && (
          <div className="flex justify-center my-5 text-gray-700">
            <p>Use "Import from Google Calendar" to load this week's shifts.</p>
          </div>
        )}

        {table && (
          <form onSubmit={uploadSchedule} className="flex justify-center mt-5 mb-20">
            <div className="grid place-items-center">
              {button && (
                <button
                  type="submit"
                  className="px-4 py-3 text-lg font-semibold text-white bg-green-600 rounded-full focus:outline-none focus:ring focus:ring-green-300 hover:bg-green-700"
                >
                  Publish Schedule
                </button>
              )}
              {!button && (
                <button
                  className="px-4 py-3 text-lg font-semibold text-white bg-gray-600 rounded-full focus:ring hover:cursor-no-drop"
                  disabled
                >
                  Publish Schedule
                </button>
              )}
              {status?.OK === false && (
                <Msg bolded={status.bolded} msg={status.msg} OK={status.OK} />
              )}
            </div>
          </form>
        )}
      </div>
    </>
  );
};

export default Schedule;

