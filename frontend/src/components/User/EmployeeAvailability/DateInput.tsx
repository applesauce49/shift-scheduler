import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

export default function DateInput(props) {
  return (
    <DayPicker
      className="m-6 md:m-8"
      mode="single"
      selected={props.selected}
      onSelect={props.setSelected}
      footer={props.footer}
      disabled={{ before: props.today }}
    />
  );
}
