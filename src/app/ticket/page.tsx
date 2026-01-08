"use client";
import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { toPng } from 'html-to-image';
import { QRCodeSVG } from 'qrcode.react';

// Tipe Data
type Registration = { id: string; child_name: string; child_class: string };
type Seat = { id: string; row_name: string; seat_number: number; is_occupied: boolean; assigned_to: string | null; registrations?: Registration | null; };
type FullRegistration = { id: string; child_name: string; child_class: string; };
type GroupedGuest = { regId: string; childName: string; childClass: string; seatNumbers: string[]; };
type GuestSeatData = { id: string; registrations: { id: string; child_name: string; child_class: string } | { id: string; child_name: string; child_class: string }[] | null; };

export default function TicketPage() {
  return ( <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-500">Loading Peta...</div>}> <TicketContent /> </Suspense> );
}

function TicketContent() {
  const searchParams = useSearchParams();
  const regId = searchParams.get('id');
  const ticketRef = useRef<HTMLDivElement>(null);

  const [mySeats, setMySeats] = useState<Seat[]>([]);
  const [allSeats, setAllSeats] = useState<Seat[]>([]);
  const [studentData, setStudentData] = useState<FullRegistration | null>(null);
  const [guestList, setGuestList] = useState<GroupedGuest[]>([]);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (typeof window !== 'undefined') setBaseUrl(window.location.origin);
      if (regId) {
        const { data: reg } = await supabase.from('registrations').select('*').eq('id', regId).single();
        if (reg) setStudentData(reg);
        const { data: mySeat } = await supabase.from('seats').select('*').eq('assigned_to', regId);
        if (mySeat) setMySeats(mySeat);
      }
      const { data: all } = await supabase.from('seats').select('*').order('row_name').order('seat_number');
      if (all) setAllSeats(all);
      const { data: guests } = await supabase.from('seats').select(`id, seat_number, is_occupied, assigned_to, registrations (id, child_name, child_class)`).eq('is_occupied', true).not('assigned_to', 'is', null).order('id', { ascending: true });
      if (guests) {
         const groupedMap = new Map<string, GroupedGuest>();
         (guests as unknown as GuestSeatData[]).forEach((seat) => {
            const reg = Array.isArray(seat.registrations) ? seat.registrations[0] : seat.registrations;
            if (!reg) return;
            if (!groupedMap.has(reg.id)) { groupedMap.set(reg.id, { regId: reg.id, childName: reg.child_name, childClass: reg.child_class, seatNumbers: [] }); }
            groupedMap.get(reg.id)?.seatNumbers.push(seat.id);
         });
         setGuestList(Array.from(groupedMap.values()));
      }
    };
    fetchData();
  }, [regId]);

  const downloadUpdatedTicket = async () => {
    if (!ticketRef.current) return;
    try {
      const dataUrl = await toPng(ticketRef.current, { cacheBust: true, pixelRatio: 3 });
      const link = document.createElement("a");
      link.download = `Tiket-TK21-${studentData?.child_name}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) { console.error("Gagal download:", err); }
  };

  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  return (
    // FIX CSS: Inline style gradient
    <div className="min-h-screen bg-gray-100 text-gray-800 p-4 pb-32 font-sans relative" style={{ background: 'linear-gradient(to bottom, #f9fafb, #ffffff)' }}>
      
      <div className="text-center mb-8 pt-4">
        <h1 className="text-2xl font-black text-gray-800 mb-1 tracking-tight">Denah Lokasi</h1>
        <p className="text-orange-500 font-bold text-sm">TK Aisyiyah 21 Rawamangun</p>
      </div>

      <div className="max-w-5xl mx-auto overflow-x-auto rounded-3xl p-8 bg-white border border-gray-200 shadow-xl mb-10 relative z-10">
        <div style={{ minWidth: '800px' }} className="text-center">
          <div className="mb-10 relative mx-auto w-2/3">
             {/* FIX CSS: Inline style gradient */}
             <div className="h-12 rounded-full shadow-lg shadow-orange-400/20 flex items-center justify-center border-4 border-orange-200" style={{ background: 'linear-gradient(to bottom, #fb923c, #f97316)' }}>
                <span className="text-xs font-black tracking-[0.3em] text-white uppercase">Panggung (Stage)</span>
             </div>
          </div>
          <div className="space-y-3">
            {rows.map((rowName) => {
              const seatsInRow = allSeats.filter(s => s.row_name === rowName);
              const halfIndex = Math.floor(seatsInRow.length / 2);
              return (
                <div key={rowName} className="flex justify-center items-center gap-2">
                  <div className="w-6 font-bold text-gray-400 text-xs">{rowName}</div>
                  {seatsInRow.map((seat, index) => {
                    const isMine = seat.assigned_to === regId;
                    const isTaken = seat.is_occupied && !isMine;
                    const isAisle = index === halfIndex; 
                    return (
                      <div key={seat.id} className={`${isAisle ? 'ml-14' : ''} w-10 h-10 flex items-center justify-center font-bold text-xs transition-all rounded-xl shadow-sm ${isMine ? 'bg-green-500 text-white shadow-lg shadow-green-500/40 z-10 scale-110 ring-2 ring-green-200' : isTaken ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-600 border border-slate-200 hover:bg-orange-50 hover:border-orange-300'}`}>
                        {seat.seat_number}
                      </div>
                    );
                  })}
                  <div className="w-6 font-bold text-gray-400 text-xs">{rowName}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {regId && (
        <div className="max-w-md mx-auto bg-white rounded-3xl overflow-hidden shadow-xl border border-gray-200 mb-16 relative z-10">
          {/* FIX CSS: Inline style gradient */}
          <div className="p-4 text-center" style={{ background: 'linear-gradient(to right, #3b82f6, #2563eb)' }}>
             <h3 className="text-white font-bold text-lg">Tiket Anda</h3>
          </div>
          <div className="p-6">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-4">
                <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Nama</p><p className="text-lg font-black text-gray-800 capitalize">{studentData?.child_name}</p></div>
                <div className="text-right"><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Kelas</p><p className="text-lg font-black text-orange-500">{studentData?.child_class}</p></div>
            </div>
            <div className="bg-orange-50 p-4 rounded-2xl flex justify-between items-center mb-6 border border-orange-100">
                <span className="font-bold text-orange-800">Nomor Kursi</span>
                <span className="text-3xl font-black text-orange-600">{mySeats.map(s => s.id).join(" & ")}</span>
            </div>
            <button onClick={downloadUpdatedTicket} className="w-full py-4 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 transition-transform active:scale-95 flex items-center justify-center gap-2">📥 Download Update Tiket</button>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto relative z-10">
        <h3 className="text-center text-lg font-bold text-gray-600 mb-4 uppercase tracking-widest">Daftar Teman Hadir</h3>
        <div className="bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-200">
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="bg-gray-100 text-gray-500 sticky top-0 uppercase text-xs font-bold tracking-wider">
                <tr><th className="px-6 py-4">Kursi</th><th className="px-6 py-4">Nama Teman</th><th className="px-6 py-4">Kelas</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {guestList.map((guest) => (
                  <tr key={guest.regId} className="hover:bg-orange-50 transition-colors">
                    <td className="px-6 py-4 font-black text-orange-600">{guest.seatNumbers.join(", ")}</td>
                    <td className="px-6 py-4 font-medium capitalize text-gray-800">{guest.childName || 'Tamu'}</td>
                    <td className="px-6 py-4 font-medium text-gray-500">{guest.childClass}</td>
                  </tr>
                ))}
                {guestList.length === 0 && <tr><td colSpan={3} className="text-center py-8 text-gray-400">Belum ada yang mendaftar.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-6 py-3 rounded-full flex items-center gap-6 border border-gray-200 shadow-xl z-50">
         <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-500 rounded-md"></div><span className="text-xs font-bold text-gray-700">Kamu</span></div>
         <div className="flex items-center gap-2"><div className="w-4 h-4 bg-slate-200 rounded-md"></div><span className="text-xs font-bold text-gray-400">Terisi</span></div>
         <div className="flex items-center gap-2"><div className="w-4 h-4 bg-white border border-gray-300 rounded-md"></div><span className="text-xs font-bold text-gray-700">Kosong</span></div>
      </div>

      <div className="absolute -z-50 opacity-0 pointer-events-none top-0 left-0">
        <div ref={ticketRef} style={{ width: '400px', height: 'auto', background: '#fff', borderRadius: '24px', overflow: 'hidden', border: '2px solid #e5e7eb' }}>
          {/* FIX CSS: Inline style gradient */}
          <div style={{ background: 'linear-gradient(to right, #f97316, #ea580c)', padding: '32px', textAlign: 'center', color: 'white' }}>
             <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '1px', margin: 0 }}>TIKET MASUK</h1>
             <p style={{ fontSize: '12px', fontWeight: 700, opacity: 0.9, marginTop: '8px', textTransform: 'uppercase' }}>Pentas Seni 2026</p>
             <p style={{ fontSize: '10px', fontWeight: 600, opacity: 0.8, marginTop: '4px' }}>TK Aisyiyah 21 Rawamangun</p>
          </div>
          <div style={{ padding: '32px', textAlign: 'center', background: 'white' }}>
             <p style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Nama Peserta</p>
             <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#1f2937', margin: '4px 0 24px 0', textTransform: 'capitalize' }}>{studentData?.child_name}</h2>
             <div style={{ borderTop: '2px dashed #e5e7eb', margin: '24px 0' }}></div>
             <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 20px' }}>
                <div style={{ textAlign: 'left' }}><p style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Kelas</p><p style={{ fontSize: '20px', fontWeight: 800, color: '#f97316' }}>{studentData?.child_class}</p></div>
                <div style={{ textAlign: 'right' }}><p style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Kursi</p><p style={{ fontSize: '24px', fontWeight: 900, color: '#f97316' }}>{mySeats.map(s => s.id).join(" & ")}</p></div>
             </div>
          </div>
          <div style={{ background: '#f9fafb', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderTop: '1px solid #f3f4f6' }}>
             <div style={{ background: 'white', padding: '10px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
               {regId && baseUrl && <QRCodeSVG value={`${baseUrl}/ticket?id=${regId}`} size={80} level={"H"} fgColor="#1f2937" />}
             </div>
             <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '12px', fontWeight: 600 }}>Scan untuk melihat peta</p>
          </div>
        </div>
      </div>

    </div>
  );
}