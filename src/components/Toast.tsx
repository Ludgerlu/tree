import React from 'react';

interface Props {
  message: string;
  visible: boolean;
}

export default function Toast({ message, visible }: Props) {
  return <div id="toast" className={visible ? 'show' : ''}>{message}</div>;
}
