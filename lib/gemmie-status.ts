import connectDB from '@/lib/mongodb';
import GemmieStatus from '@/models/GemmieStatus';
import redis from '@/lib/redis';

const GEMMIE_TEMP_DISABLED_KEY = 'gemmie:temp-disabled';
const TEMP_DISABLE_SECONDS = 120;

export async function isGemmieTemporarilyDisabled(): Promise<boolean> {
  try {
    const value = await redis.get(GEMMIE_TEMP_DISABLED_KEY);
    return value === '1';
  } catch (error) {
    console.error('❌ Error checking Gemmie temporary disable:', error);
    return false;
  }
}

export async function setGemmieTemporarilyDisabled(seconds = TEMP_DISABLE_SECONDS): Promise<boolean> {
  try {
    const result = await redis.set(GEMMIE_TEMP_DISABLED_KEY, '1', { ex: seconds });
    return result === 'OK';
  } catch (error) {
    console.error('❌ Error setting Gemmie temporary disable:', error);
    return false;
  }
}

export async function clearGemmieTemporaryDisable(): Promise<boolean> {
  try {
    await redis.del(GEMMIE_TEMP_DISABLED_KEY);
    return true;
  } catch (error) {
    console.error('❌ Error clearing Gemmie temporary disable:', error);
    return false;
  }
}

export async function getGemmieStatus(): Promise<boolean> {
  try {
    if (await isGemmieTemporarilyDisabled()) {
      console.log('🤖 Gemmie is temporarily disabled by cooldown');
      return false;
    }

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

    if (enabled) {
      await clearGemmieTemporaryDisable();
    }
    
    console.log('✅ Gemmie status updated to:', enabled, 'by:', userName);
    return true;
  } catch (error) {
    console.error('❌ Error setting Gemmie status:', error);
    return false;
  }
}