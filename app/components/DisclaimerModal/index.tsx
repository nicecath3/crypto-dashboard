'use client';

import { useEffect, useState } from 'react';
import styles from './DisclaimerModal.module.scss';

const DISCLAIMER_KEY = 'disclaimer-confirmed';

export function DisclaimerModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(DISCLAIMER_KEY)) setVisible(true);
  }, []);

  const confirm = () => {
    localStorage.setItem(DISCLAIMER_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.icon}>⚠️</div>
        <h2 className={styles.title}>가상 투자 시뮬레이터</h2>
        <p className={styles.body}>
          본 서비스는 <strong>가상 투자 시뮬레이터</strong>입니다.<br />
          실제 자산과 무관하며 투자 권유가 아닙니다.<br />
          실제 투자 결정은 본인 책임 하에 신중하게 하시기 바랍니다.
        </p>
        <ul className={styles.list}>
          <li>표시되는 가격은 업비트 실시간 데이터입니다</li>
          <li>가상 자산으로만 거래되며 실제 거래가 발생하지 않습니다</li>
          <li>투자 손실에 대한 책임은 본인에게 있습니다</li>
        </ul>
        <button className={styles.btn} onClick={confirm}>
          확인했습니다
        </button>
      </div>
    </div>
  );
}
