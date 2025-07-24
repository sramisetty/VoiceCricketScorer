import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function TestDialog() {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => {
    console.log('Opening test dialog...');
    setIsOpen(true);
    console.log('Dialog state should be:', true);
  };

  const handleClose = () => {
    console.log('Closing test dialog...');
    setIsOpen(false);
  };

  console.log('Test Dialog render, isOpen:', isOpen);

  return (
    <>
      <Button onClick={handleOpen} variant="outline">
        Test Simple Dialog
      </Button>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent style={{ zIndex: 9999 }}>
          <DialogHeader>
            <DialogTitle>Test Dialog</DialogTitle>
            <DialogDescription>
              This is a simple test dialog to verify dialog functionality works.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p>If you can see this dialog, the dialog system is working correctly.</p>
            <p>Dialog state: {isOpen ? 'Open' : 'Closed'}</p>
            <p>Current time: {new Date().toLocaleTimeString()}</p>
          </div>
          <DialogFooter>
            <Button onClick={handleClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}