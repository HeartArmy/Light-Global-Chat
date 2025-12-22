import connectDB from '@/lib/mongodb';
import GemmieStatus from '@/models/GemmieStatus';

export async function getGemmieStatus(): Promise<boolean> {
  try {
    await connectDB();
    
    let status = await GemmieStatus.findOne();
    if (!status) {
      // Create default status if none exists (enabled by default)
      status = await GemmieStatus.create({ enabled: true });
    }
    
    console.log('🤖 Gemmie status:', status.enabled);
    return status.enabled;
  } catch (error) {
    console.error('❌ Error getting Gemmie status:', error);
    // Default to disabled on error to be safe
    return false;
  }
}

export async function setGemmieStatus(enabled: boolean, userName: string): Promise<boolean> {
  try {
    if (userName !== 'arham' && userName !== 'gemmie') {
      console.log('❌ Unauthorized attempt to change Gemmie status by:', userName);
      return false;
    }

    await connectDB();
    
    let status = await GemmieStatus.findOne();
    if (!status) {
      status = await GemmieStatus.create({ 
        enabled, 
        updatedBy: userName,
        lastUpdated: new Date()
      });
    } else {
      status.enabled = enabled;
      status.updatedBy = userName;
      status.lastUpdated = new Date();
      await status.save();
    }
    
    console.log('✅ Gemmie status updated to:', enabled, 'by:', userName);
    return true;
  } catch (error) {
    console.error('❌ Error setting Gemmie status:', error);
    return false;
  }
}