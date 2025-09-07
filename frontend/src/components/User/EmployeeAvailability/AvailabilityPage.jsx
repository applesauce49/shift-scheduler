import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../Navbar';
import axios from 'axios';
import { format } from 'date-fns';
// import 'react-day-picker/style.css';
import DateInput from './DateInput.tsx';
// import Table from './Table';
import BlockRequestButton from './BlockRequestButton';
import HashLoader from 'react-spinners/HashLoader';
import { useUserContext } from '../../useUserContext';
import CommentTextArea from './CommentTextArea';
import Msg from '../../general/Msg';

const AvailabilityPage = () => {
  const { user, refresh } = useUserContext();
  const [requestStatus, setReqStatus] = useState(null);

  let navigate = useNavigate();

  const [selected, setSelected] = useState(null);
  const today = new Date();

  let footer = 'Please select a date';
  if (selected) {
    footer = `${format(selected, 'EEEE, d LLLL yyyy')}.`;
  }

  let props = {
    selected,
    setSelected,
    footer,
    today,
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selected) {
      const date = format(selected, 'dd-MM-yyyy');
      const comment = e.target.comment.value;
      const response = await axios.post('/block-date', { date, comment });

      if (response.data.msg === 'BlockAlreadyRequested') {
        setReqStatus({
          bold: 'Error',
          msg: `A block request already exists for this date`,
          OK: false,
        });
      } else if (response.data.msg === 'BlockRequestSuccess') {
        setReqStatus({
          bold: 'OK!',
          msg: `Request sent successfully`,
          OK: true,
        });
        refresh();
      }
    } else {
      setReqStatus({
        bold: 'Error',
        msg: 'No date selected',
        OK: false,
      });
    }
  };

  if (user && user.isAuthenticated === false) {
    navigate('/login');
  }

  if (!user) {
    return (
      <>
        <div className="grid w-screen h-screen place-items-center">
          <HashLoader className="content-center" size={100} />
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="flex justify-center">
        <form onSubmit={handleSubmit}>
          <DateInput {...props} />
          <CommentTextArea />
          <BlockRequestButton type="submit" />
          {requestStatus && (
            <Msg bolded={requestStatus.bold} msg={requestStatus.msg} OK={requestStatus.OK} />
          )}
        </form>
        {/* <Table /> */}
      </div>
    </>
  );
};

export default AvailabilityPage;
